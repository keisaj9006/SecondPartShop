import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { buildManifest } from "./rc04-disposable-replay.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const correctiveMigration = "supabase/migrations/20261014202700_review_ready_notifications_forward.sql";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const md5 = (value) => createHash("md5").update(value).digest("hex");

export function validateEnvironmentSnapshot(snapshot, { phase = "postflight" } = {}) {
  const major = Number.parseInt(snapshot.serverVersion, 10);
  if (major !== 17) throw new Error(`PostgreSQL 17.x is required; received ${snapshot.serverVersion}`);
  const requiredSchemas = phase === "preflight" ? ["auth", "storage"] : ["auth", "storage", "cron"];
  for (const schema of requiredSchemas) {
    if (!snapshot.schemas.includes(schema)) throw new Error(`Native Supabase schema missing: ${schema}`);
  }
  for (const extension of ["pg_cron", "pg_trgm", "pgcrypto"]) {
    if (!snapshot.availableExtensions.includes(extension)) throw new Error(`Native PostgreSQL extension package missing: ${extension}`);
    if (phase === "postflight" && !snapshot.installedExtensions.includes(extension)) {
      throw new Error(`Native PostgreSQL extension missing after replay: ${extension}`);
    }
  }
  return { postgresMajor: major, nativeAuth: true, nativeStorage: true, nativeCron: snapshot.schemas.includes("cron") && snapshot.installedExtensions.includes("pg_cron") };
}

export function validateReplayManifest(manifest) {
  if (manifest.some((entry) => entry.files.includes(correctiveMigration))) {
    throw new Error("The corrective review_ready migration must not be part of the baseline replay");
  }
  if (manifest.length !== 207) throw new Error(`Expected the audited 207-unit baseline; received ${manifest.length}`);
  return { unitCount: manifest.length };
}

function psql({ databaseUrl, psqlPath, sql, file }) {
  const args = ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "--dbname", databaseUrl];
  if (file) args.push("--file", file);
  else args.push("--command", sql);
  const result = spawnSync(psqlPath, args, {
    encoding: "utf8",
    env: { ...process.env, PAGER: "" },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const safeError = `${result.stderr || result.stdout || "psql failed"}`.replaceAll(databaseUrl, "<redacted-db-url>");
    throw new Error(safeError.trim());
  }
  return result.stdout.trim();
}

function queryJson(options, query) {
  const output = psql({ ...options, sql: `select row_to_json(result) from (${query}) result;` });
  return JSON.parse(output);
}

function queryJsonRows(options, query) {
  const output = psql({ ...options, sql: `select coalesce(json_agg(result),'[]'::json) from (${query}) result;` });
  return JSON.parse(output);
}

function readEnvironment(options) {
  return queryJson(options, `
    select current_setting('server_version') as "serverVersion",
      array(select schema_name from information_schema.schemata order by schema_name) as schemas,
      array(select extname from pg_extension order by extname) as "installedExtensions",
      array(select name from pg_available_extensions order by name) as "availableExtensions"
  `);
}

function captureCatalog(options) {
  const functions = queryJsonRows(options, `
    select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,
      md5(pg_get_functiondef(p.oid)) definition_md5,p.prosecdef,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
      has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,
      has_function_privilege('service_role',p.oid,'EXECUTE') service_exec
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
      and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
    order by n.nspname,p.proname,args
  `);
  const triggers = queryJsonRows(options, `
    select n.nspname,c.relname,t.tgname,md5(pg_get_triggerdef(t.oid)) definition_md5
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname in ('public','private')
    order by n.nspname,c.relname,t.tgname
  `);
  const policies = queryJsonRows(options, `
    select schemaname,tablename,policyname,roles,cmd,qual,with_check
    from pg_policies where schemaname in ('public','private')
    order by schemaname,tablename,policyname
  `);
  const grants = queryJsonRows(options, `
    select table_schema,table_name,grantee,privilege_type
    from information_schema.role_table_grants
    where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role')
    order by table_schema,table_name,grantee,privilege_type
  `);
  const cronJobs = queryJsonRows(options, `select jobname,schedule,command,active from cron.job order by jobname`);
  return {
    counts: { functions: functions.length, triggers: triggers.length, policies: policies.length, grants: grants.length, cronJobs: cronJobs.length },
    fingerprints: {
      functions: sha256(JSON.stringify(functions)), triggers: sha256(JSON.stringify(triggers)),
      policies: sha256(JSON.stringify(policies)), grants: sha256(JSON.stringify(grants)), cronJobs: sha256(JSON.stringify(cronJobs)),
    },
    hostedComparableFingerprints: {
      functions: md5(functions.map((row) => JSON.stringify(row)).join("\n")),
      triggers: md5(triggers.map((row) => JSON.stringify(row)).join("\n")),
      policies: md5(policies.map((row) => JSON.stringify(row)).join("\n")),
      grants: md5(grants.map((row) => JSON.stringify(row)).join("\n")),
      cronJobs: md5(cronJobs.map((row) => JSON.stringify(row)).join("\n")),
    },
    functions, triggers, policies, grants, cronJobs,
  };
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) args.set(argv[index], argv[index + 1]);
  return args;
}

export function runNativeReplay({ databaseUrl, psqlPath, outPath }) {
  if (!databaseUrl) throw new Error("RC05_DATABASE_URL is required");
  const options = { databaseUrl, psqlPath };
  const manifest = buildManifest();
  validateReplayManifest(manifest);
  const environment = readEnvironment(options);
  const platformPreflight = validateEnvironmentSnapshot(environment, { phase: "preflight" });
  const existingAppTables = Number(psql({ ...options, sql: "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';" }));
  if (existingAppTables !== 0) throw new Error(`Clean-state contract failed: ${existingAppTables} public base tables already exist`);

  const report = { status: "RUNNING", engine: "native Supabase Docker stack", environmentPreflight: environment, platformPreflight, manifestCount: manifest.length, entries: [] };
  const scratch = mkdtempSync(path.join(tmpdir(), "secondpart-rc05-sql-"));
  try {
    for (const [index, entry] of manifest.entries()) {
      const source = entry.files.map((name) => readFileSync(path.join(root, name), "utf8")).join("\n").replaceAll("\r\n", "\n");
      const detail = { index: index + 1, ...entry, sha256: sha256(source), status: "RUNNING" };
      report.entries.push(detail);
      const sqlPath = path.join(scratch, `${String(index + 1).padStart(3, "0")}-${entry.version}.sql`);
      writeFileSync(sqlPath, `begin;\n${source}\ncommit;\n`);
      try {
        psql({ ...options, file: sqlPath });
        detail.status = "PASS";
      } catch (error) {
        detail.status = "FAIL";
        detail.error = String(error.message).slice(0, 4000);
        report.status = "FAIL";
        break;
      }
    }
    if (report.status === "RUNNING") {
      report.environmentPostflight = readEnvironment(options);
      report.platformPostflight = validateEnvironmentSnapshot(report.environmentPostflight, { phase: "postflight" });
      report.catalog = captureCatalog(options);
      report.status = "PASS";
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(args.get("--out") ?? path.join(root, "docs/test-runs/2026-10-28-rc05-native-replay.json"));
  const psqlPath = args.get("--psql") ?? "psql";
  const report = runNativeReplay({ databaseUrl: process.env.RC05_DATABASE_URL, psqlPath, outPath });
  console.log(JSON.stringify({ status: report.status, manifestCount: report.manifestCount, applied: report.entries.filter((entry) => entry.status === "PASS").length, outPath }, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
}
