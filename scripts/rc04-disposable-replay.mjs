import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrixPath = path.join(root, "docs/test-runs/2026-10-14-rc02-migration-matrix.csv");
const outPath = process.argv[2] ?? path.join(root, "docs/test-runs/2026-10-14-rc04-replay-log.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function parseCsv(input) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...records] = rows;
  return records.map((values) => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""])));
}

export function buildManifest() {
  const matrix = parseCsv(readFileSync(matrixPath, "utf8"));
  const source = matrix.filter((row) => row.local_path.startsWith("supabase/migrations/") && row.sql_comparison !== "NO_LEDGER");
  const byVersion = new Map();
  for (const row of source) {
    const earlierSellerGuard = row.local_path.includes("20260906223000_invalidate_verification");
    const version = earlierSellerGuard ? row.local_version : row.hosted_version;
    if (!version) throw new Error(`Unmapped source: ${row.local_path}`);
    const key = row.hosted_version === "20260921133420" ? version : `${version}:${row.local_path}`;
    if (!byVersion.has(key)) byVersion.set(key, { version, hosted_version: row.hosted_version, files: [], classification: earlierSellerGuard ? "SOURCE_ONLY_SUPERSEDED" : "MAPPED" });
    byVersion.get(key).files.push(row.local_path);
  }
  const adopted = "supabase/migrations/20261008130523_account_deletion_checkout_fitting_serialization.sql";
  byVersion.set(`20261008130523:${adopted}`, { version: "20261008130523", hosted_version: "20261008130523", files: [adopted], classification: "EXACT_HOSTED_SOURCE_ADOPTED" });
  return [...byVersion.values()].sort((a, b) => a.version.localeCompare(b.version) || a.files[0].localeCompare(b.files[0]));
}

const bootstrap = `
  create schema auth; create schema storage; create schema extensions; create schema cron;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  alter default privileges in schema public revoke execute on functions from public;
  alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
  create table auth.users(id uuid primary key, raw_user_meta_data jsonb, raw_app_meta_data jsonb, email text, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)$$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
  create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text);
  create function cron.schedule(text,text,text) returns bigint language plpgsql as $$declare result bigint; begin insert into cron.job(jobname,schedule,command) values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid into result; return result; end$$;
  create function cron.unschedule(bigint) returns boolean language sql as $$delete from cron.job where jobid=$1 returning true$$;
`;

async function run() {
  const manifest = buildManifest();
  const report = { engine: "PGlite 0.5.8 / PostgreSQL 18.3 WASM", limitations: ["Supabase auth/storage/pg_cron are explicit disposable shims; pg_cron scheduling is not exercised", "Hosted PostgreSQL version and extension setup may differ"], manifest_count: manifest.length, entries: [], status: "RUNNING" };
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  try {
    await db.exec(bootstrap);
    const clean = await db.query("select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'");
    if (clean.rows[0].n !== 0) throw new Error("Clean-state contract failed: public tables already exist");
    for (const entry of manifest) {
      const executionFiles = entry.files;
      let source = executionFiles.map((name) => readFileSync(path.join(root, name), "utf8")).join("\n");
      const originalSha256 = sha256(source);
      source = source.replace(/\r\n/g, "\n");
      let localAdaptation = null;
      if (entry.files[0] === "supabase/migrations/20260906170000_checkout_expiry_cron.sql") {
        const extensionLine = /^create extension if not exists pg_cron;\r?\n/i;
        if (!extensionLine.test(source)) throw new Error("Expected pg_cron extension statement changed");
        source = source.replace(extensionLine, "");
        localAdaptation = "pg_cron extension creation omitted; disposable cron.job/schedule/unschedule shim used";
      }
      const detail = { ...entry, executionFiles, originalSha256, sha256: sha256(source), localAdaptation, status: "RUNNING" };
      report.entries.push(detail);
      try {
        await db.exec("BEGIN");
        await db.exec(source);
        await db.exec("COMMIT");
        detail.status = "PASS";
      } catch (error) {
        await db.exec("ROLLBACK").catch(() => {});
        detail.status = "FAIL";
        detail.error = String(error.message).slice(0, 1000);
        if (detail.error.includes("Marketplace RPC definition drift")) {
          const diagnostic = await db.query("select pg_get_functiondef('public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid)'::regprocedure) definition");
          const definition = diagnostic.rows[0].definition;
          const marker = definition.lastIndexOf("from combined");
          detail.pg18_definition_md5 = createHash("md5").update(definition).digest("hex");
          detail.pg18_definition_excerpt = marker >= 0 ? definition.slice(marker, marker + 160) : definition.slice(-160);
        }
        report.status = "FAIL";
        break;
      }
    }
    if (report.status === "RUNNING") {
      report.status = "PASS_WITH_SHIMS";
      report.catalog = (await db.query("select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args, md5(pg_get_functiondef(p.oid)) definition_md5, p.prosecdef, p.proconfig, has_function_privilege('anon',p.oid,'EXECUTE') anon_exec, has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec, has_function_privilege('service_role',p.oid,'EXECUTE') service_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by n.nspname,p.proname,args")).rows;
      const hostedInventory = JSON.parse(readFileSync(path.join(root, "docs/test-runs/2026-10-14-rc04-hosted-function-inventory.json"), "utf8"));
      const hostedHash = new Map(hostedInventory.functions.map((item) => [item.signature, item.definition_md5]));
      const differentSignatures = new Set(report.catalog.filter((item) => hostedHash.get(`${item.nspname}.${item.proname}(${item.args})`) !== item.definition_md5).map((item) => `${item.nspname}.${item.proname}(${item.args})`));
      report.drift_definitions = (await db.query("select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by signature")).rows.filter((item) => differentSignatures.has(item.signature));
      report.triggers = (await db.query("select n.nspname, c.relname, t.tgname, md5(pg_get_triggerdef(t.oid)) definition_md5 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','private') order by n.nspname,c.relname,t.tgname")).rows;
      report.policies = (await db.query("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private') order by schemaname,tablename,policyname")).rows;
      report.critical_grants = (await db.query("select n.nspname||'.'||c.relname object,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select,has_table_privilege('authenticated',c.oid,'INSERT') authenticated_insert,has_table_privilege('authenticated',c.oid,'UPDATE') authenticated_update,has_table_privilege('authenticated',c.oid,'DELETE') authenticated_delete from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('orders','order_items','notifications','transaction_cases','transaction_case_evidence','account_deletion_requests','sellers') order by object")).rows;
      report.categories = (await db.query("select count(*)::int n,md5(string_agg(jsonb_build_array(id,name,slug,parent_id,is_transmission_related,is_selectable,sort_order,search_terms)::text,E'\\n' order by id)) fingerprint from public.categories")).rows[0];
      const candidate = readFileSync(path.join(root, "supabase/migrations/20261014202700_review_ready_notifications_forward.sql"), "utf8").replace(/\r\n/g, "\n");
      report.candidateSha256 = sha256(candidate);
      await db.exec("BEGIN");
      await db.exec(candidate);
      await db.exec("COMMIT");
      await db.exec("BEGIN");
      await db.exec(candidate);
      await db.exec("COMMIT");
      report.candidateReadback = (await db.query("select (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='notify_transaction_review_ready') function_count,(select count(*)::int from pg_trigger where tgname='transaction_review_ready_notification' and not tgisinternal) trigger_count,(select count(*)::int from pg_indexes where schemaname='public' and tablename='notifications' and indexname='notifications_profile_dedupe_unique') dedupe_index_count")).rows[0];
      await db.exec("BEGIN");
      await db.exec("drop trigger transaction_review_ready_notification on public.order_items; drop function private.notify_transaction_review_ready();");
      await db.exec("COMMIT");
      report.rollbackReadback = (await db.query("select (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='notify_transaction_review_ready') function_count,(select count(*)::int from pg_trigger where tgname='transaction_review_ready_notification' and not tgisinternal) trigger_count")).rows[0];
    }
  } catch (error) {
    report.status = "FAIL";
    report.fatal = String(error.message).slice(0, 1000);
  } finally {
    await db.close();
  }
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, manifest_count: report.manifest_count, applied: report.entries.filter((item) => item.status === "PASS").length, failure: report.entries.find((item) => item.status === "FAIL") ?? report.fatal, outPath }, null, 2));
  if (report.status === "FAIL") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
