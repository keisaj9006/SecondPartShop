import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {spawnSync} from "node:child_process";

const root=path.resolve(import.meta.dirname,"..");
const databaseUrl=process.env.TEST_DATABASE_URL;
if(!databaseUrl)throw new Error("TEST_DATABASE_URL is required for the isolated PostgreSQL scale verifier.");

const fixtureCount=25_000;
const queryText="Scale alternator";
const migrationName="20260912110440_complete_marketplace_search_page.sql";
const migrationPath=path.join(root,"supabase/migrations",migrationName);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const ids=(from,to,step=1)=>{const values=[];for(let value=from;step>0?value<=to:value>=to;value+=step)values.push(id(value));return values;};
const migration=name=>fs.readFileSync(path.join(root,"supabase/migrations",name),"utf8");

function definition(source,kind,name){
 const escaped=name.replaceAll(".","\\.");
 const pattern=kind==="function"
  ?new RegExp(`create or replace function ${escaped}\\([\\s\\S]*?\\$\\$;`,"gi")
  :new RegExp(`create table (?:if not exists )?${escaped} \\([\\s\\S]*?;`,"gi");
 const found=[...source.matchAll(pattern)];
 assert.equal(found.length,1,`${kind} ${name}: exactly one complete definition required`);
 return found[0][0];
}

function psql(sql,{tuples=true}={}){
 const args=[databaseUrl,"-X","-v","ON_ERROR_STOP=1"];
 if(tuples)args.push("-qAt");
 const result=spawnSync("psql",args,{input:sql,encoding:"utf8",maxBuffer:32*1024*1024});
 if(result.status!==0){
  const stderr=(result.stderr||"").trim();
  const stdout=(result.stdout||"").trim();
  throw new Error(`psql failed (${result.status}): ${stderr||stdout||"unknown PostgreSQL error"}`);
 }
 return (result.stdout||"").trim();
}

function bootstrapSql(){
 const statements=[];
 statements.push(`
create schema extensions;
create extension pg_trgm with schema extensions;
create schema auth;
create schema private;
revoke all on schema private from public;
create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
grant usage on schema public,auth to anon,authenticated;
grant usage on schema private to authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create type public.user_role as enum ('buyer','seller','admin');
create type public.part_condition as enum ('new','reconditioned','used');
create type public.listing_status as enum ('draft','active','reserved','sold','archived');
create type public.vehicle_data_status as enum ('verified','qa_seed','external_import');
`);
 const base=migration("20260903142834_marketplace.sql");
 for(const name of ["profiles","sellers","categories","vehicles","parts","part_fitments","orders","order_items"])statements.push(definition(base,"table",`public.${name}`));
 for(const name of ["is_admin","owns_seller"])statements.push(definition(base,"function",`private.${name}`));
 statements.push("revoke all on function private.is_admin(),private.owns_seller(uuid) from public; grant execute on function private.is_admin(),private.owns_seller(uuid) to authenticated;");
 for(const [file,name] of [
  ["20260904162532_dft_vehicle_catalogue.sql","vehicle_catalogue_variants"],
  ["20260904170926_part_catalogue_fitments.sql","part_catalogue_fitments"],
  ["20260905121511_seller_donor_vehicles.sql","donor_vehicles"]
 ])statements.push(definition(migration(file),"table",`public.${name}`));
 statements.push(fs.readFileSync(path.join(root,"scripts/fixtures/marketplace-search-schema.sql"),"utf8"));
 for(const file of ["20260905120409_listing_trust_details.sql","20260905122609_local_collection_delivery_eta.sql"])statements.push(migration(file));
 for(const [file,table] of [["20260906122500_trust_reputation_foundation.sql","transaction_reviews"],["20260906180000_transaction_cases_and_refunds.sql","transaction_cases"]])statements.push(definition(migration(file),"table",`public.${table}`));
 for(const [file,table,constraint] of [
  ["20260906122500_trust_reputation_foundation.sql","order_items","order_items_fulfilment_status_check"],
  ["20260906141000_commerce_core_foundation.sql","orders","orders_payment_status_check"],
  ["20260906141000_commerce_core_foundation.sql","order_items","order_items_payout_status_check"]
 ]){
  const found=migration(file).match(new RegExp(`alter table public.${table}\\s+add constraint ${constraint}[^;]+;`,"g"));
  assert.equal(found?.length,1,`constraint ${constraint}: exactly one definition required`);
  statements.push(found[0]);
 }
 const returnStates=migration("20260906194500_physical_return_lifecycle.sql");
 const returnBoundary=returnStates.indexOf("alter table public.transaction_cases",returnStates.indexOf("check (status"));
 assert.ok(returnBoundary>0,"physical return state boundary must be found");
 statements.push(returnStates.slice(0,returnBoundary));
 const policy=migration("20260903143143_advisor_fixes.sql");
 for(const name of ["parts anon read active","parts authenticated read"]){
  const found=policy.match(new RegExp(`create policy "${name}"[^;]+;`,"g"));
  assert.equal(found?.length,1,`policy ${name}: exactly one definition required`);
  statements.push(found[0]);
 }
 statements.push(definition(migration("20260905115729_compatibility_confidence.sql"),"function","public.marketplace_legacy_vehicle_compatibility"));
 statements.push(migration("20260905121247_marketplace_search_synonyms.sql"));
 const feedback=migration("20260906263000_verified_fit_feedback.sql");
 statements.push(definition(feedback,"table","public.verified_fit_feedback"));
 const feedbackStart=feedback.indexOf("alter table public.verified_fit_feedback enable");
 const feedbackEnd=feedback.indexOf("create or replace function public.prepare_checkout_order_v2");
 assert.ok(feedbackStart>=0&&feedbackEnd>feedbackStart,"verified fit policy slice must be found");
 statements.push(feedback.slice(feedbackStart,feedbackEnd));
 statements.push(definition(feedback,"function","public.marketplace_catalogue_compatibility"));
 for(const name of [
  "20260907125000_catalogue_sorted_marketplace_page.sql",
  "20260907130500_indexed_marketplace_search.sql",
  "20260907163500_filter_invalid_verified_fit_evidence.sql",
  "20260907165000_filter_invalid_transactions_from_public_reputation.sql",
  "20260909100500_indexed_marketplace_search_candidates.sql",
  "20260909202000_catalogue_compatibility_cursor.sql",
  "20260909203500_distance_page_v2.sql",
  "20260911090000_consolidate_seller_read_policy.sql",
  "20260911211956_guard_catalogue_verified_fit_evidence.sql"
 ])statements.push(migration(name));
 return statements.join("\n");
}

function seedSql(){
 return `
insert into auth.users values ('${id(9001)}');
insert into profiles(id,role,display_name) values ('${id(9001)}','admin','Scale fixture admin');
insert into sellers(id,owner_id,business_name,slug,location,latitude,longitude)
values ('${id(8001)}','${id(9001)}','Scale recycler','scale-recycler','Scale fixture',55,-3);
insert into categories(id,name,slug) values
('${id(7001)}','Scale components','scale-components'),
('${id(7002)}','Selected scale components','selected-scale-components');
insert into parts(id,seller_id,category_id,title,slug,description,oem_number,condition,price_pence,status,created_at,delivery_days_min,warranty_days)
select
 ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '${id(8001)}',
 case when n=${fixtureCount} then '${id(7002)}' else '${id(7001)}' end::uuid,
 '${queryText}',
 'scale-part-'||n,
 'A deterministic isolated scale fixture listing',
 case when n=${fixtureCount} then 'SCALE-OEM-25000' end,
 'used',
 n,
 'active',
 '2026-01-01'::timestamptz-n*interval '1 second',
 5,
 30
from generate_series(1,${fixtureCount}) n;
analyze public.parts;
`;
}

function queryIds({query=queryText,sort="best",categoryIds=null,limit=24,offset=0}){
 const categorySql=categoryIds?.length?`array[${categoryIds.map(value=>`'${value}'::uuid`).join(",")}]`:`null::uuid[]`;
 const safeQuery=query.replaceAll("'","''");
 const safeSort=sort.replaceAll("'","''");
 const sql=`select part_id::text from public.marketplace_search_page_v1(
  p_query=>'${safeQuery}',p_sort=>'${safeSort}',p_limit=>${limit},p_offset=>${offset},p_category_ids=>${categorySql}
 );`;
 const start=performance.now();
 const output=psql(sql);
 const durationMs=Number((performance.now()-start).toFixed(1));
 return {ids:output?output.split(/\r?\n/).filter(Boolean):[],durationMs};
}

const totalStart=performance.now();
const setupStart=performance.now();
psql(bootstrapSql(),{tuples:false});
const bootstrapMs=Number((performance.now()-setupStart).toFixed(1));

const seedStart=performance.now();
psql(seedSql(),{tuples:false});
const seedMs=Number((performance.now()-seedStart).toFixed(1));
const actualCount=Number(psql("select count(*) from public.parts;"));
assert.equal(actualCount,fixtureCount,"the isolated PostgreSQL fixture contains exactly 25,000 listings");

const migrationSql=fs.readFileSync(migrationPath,"utf8");
const migrationSha256=crypto.createHash("sha256").update(migrationSql).digest("hex");
const migrationStart=performance.now();
psql(migrationSql,{tuples:false});
const migrationMs=Number((performance.now()-migrationStart).toFixed(1));

const scenarios=[];
function verify(name,input,expectedIds){
 const result=queryIds(input);
 assert.ok(result.ids.length<=Math.min(Math.max(input.limit??24,1),60)+1,`${name} stays within the bounded page plus sentinel`);
 assert.deepEqual(result.ids,expectedIds,`${name} preserves global order before pagination`);
 scenarios.push({name,rowCount:result.ids.length,firstPartId:result.ids[0]??null,lastPartId:result.ids.at(-1)??null,durationMs:result.durationMs});
}

verify("filtered_compact_oem",{query:"SCALEOEM25000",categoryIds:[id(7002)]},[id(25_000)]);
verify("best_first_page",{},ids(1,25));
verify("price_desc_clamped_page",{sort:"price_desc",limit:1000},ids(25_000,24_940,-1));
verify("price_asc_deep_page",{sort:"price_asc",offset:24_960},ids(24_961,24_985));
verify("price_desc_deep_page",{sort:"price_desc",offset:24_960},ids(40,16,-1));
verify("best_terminal_page",{offset:24_984},ids(24_985,25_000));

const runtime=psql("select version()||E'\\t'||(select extversion from pg_extension where extname='pg_trgm');").split("\t");
const report={
 status:"PASS",
 fixtureCount:actualCount,
 scope:{fixture:"isolated PostgreSQL 17 service container",sharedSupabaseWrites:0,hostedLatency:false,imageDelivery:false,concurrentLoad:false},
 runtime:{postgresql:runtime[0]??null,pgTrgm:runtime[1]??null},
 migration:{path:`supabase/migrations/${migrationName}`,sha256:migrationSha256},
 timingsMs:{bootstrap:bootstrapMs,seed:seedMs,migration:migrationMs,queries:scenarios,total:Number((performance.now()-totalStart).toFixed(1))},
 verified:[
  "exactly 25,000 synthetic listings",
  "current checked-in search migration loaded unchanged",
  "compact OEM matching under a category filter",
  "bounded limit-plus-one pages",
  "global best and price ordering before pagination",
  "deep and terminal pagination behavior"
 ]
};
console.log(JSON.stringify(report,null,2));