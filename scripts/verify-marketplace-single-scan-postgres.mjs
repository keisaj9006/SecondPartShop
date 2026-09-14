import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {spawnSync} from "node:child_process";

const root=path.resolve(import.meta.dirname,"..");
const databaseUrl=process.env.TEST_DATABASE_URL;
if(!databaseUrl)throw new Error("TEST_DATABASE_URL is required for the isolated single-scan verifier.");

const migrationPath=path.join(root,"supabase/migrations/20260914103500_single_scan_marketplace_search_candidates.sql");
const queryText="Scale alternator";
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const ids=(from,to,step=1)=>{const values=[];for(let value=from;step>0?value<=to:value>=to;value+=step)values.push(id(value));return values;};

function psql(sql,{tuples=true}={}){
 const args=[databaseUrl,"-X","-v","ON_ERROR_STOP=1"];
 if(tuples)args.push("-qAt");
 const result=spawnSync("psql",args,{input:sql,encoding:"utf8",maxBuffer:64*1024*1024});
 if(result.status!==0)throw new Error((result.stderr||result.stdout||"psql failed").trim());
 return (result.stdout||"").trim();
}

function functionCall({query=queryText,sort="best",categoryIds=null,limit=24,offset=0}){
 const categorySql=categoryIds?.length?`array[${categoryIds.map(value=>`'${value}'::uuid`).join(",")}]`:`null::uuid[]`;
 return `public.marketplace_search_page_v1(
  p_query=>'${query.replaceAll("'","''")}',p_sort=>'${sort.replaceAll("'","''")}',p_limit=>${limit},p_offset=>${offset},p_category_ids=>${categorySql}
 )`;
}

function queryIds(input){
 const start=performance.now();
 const output=psql(`select row_to_json(page)::text from ${functionCall(input)} page;`);
 const durationMs=Number((performance.now()-start).toFixed(1));
 const rows=output?output.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)):[];
 return {ids:rows.map(row=>row.part_id),durationMs,payloadBytes:Buffer.byteLength(output,"utf8")};
}

function explain(name,input){
 const document=JSON.parse(psql(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) select * from ${functionCall(input)};`));
 const statement=document[0];
 const plan=statement.Plan;
 return {
  name,
  executionTimeMs:statement["Execution Time"],
  planningTimeMs:statement["Planning Time"],
  sharedHitBlocks:plan["Shared Hit Blocks"]??0,
  sharedReadBlocks:plan["Shared Read Blocks"]??0,
  actualRows:plan["Actual Rows"]??null
 };
}

psql(`do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin nosuperuser nobypassrls; end if; end $$;`,{tuples:false});
psql(fs.readFileSync(migrationPath,"utf8"),{tuples:false});

const definition=psql(`select pg_get_functiondef('public.marketplace_search_page_v1(text,text,uuid[],text,integer,integer,boolean,uuid,smallint,text,integer,uuid,boolean,double precision,double precision,uuid[],integer,integer)'::regprocedure);`);
const candidateStart=definition.indexOf("candidate_ids as (");
const candidateEnd=definition.indexOf("),\n documents as (",candidateStart);
assert.ok(candidateStart>=0&&candidateEnd>candidateStart,"patched function retains candidate_ids before documents");
const candidateCte=definition.slice(candidateStart,candidateEnd);
assert.doesNotMatch(candidateCte,/\bunion\b/i,"patched candidate discovery is a single eligible scan");
assert.match(candidateCte,/p\.search_document@@q\.ts_query/i);
assert.match(candidateCte,/p\.category_id in/i);

const scenarios=[];
function verify(name,input,expectedIds){
 const result=queryIds(input);
 assert.deepEqual(result.ids,expectedIds,`${name} preserves complete global ordering after the single-scan patch`);
 assert.ok(result.ids.length<=Math.min(Math.max(input.limit??24,1),60)+1,`${name} remains bounded`);
 scenarios.push({name,rowCount:result.ids.length,durationMs:result.durationMs,payloadBytes:result.payloadBytes});
}

verify("filtered_compact_oem",{query:"SCALEOEM100000",categoryIds:[id(7002)]},[id(100_000)]);
verify("best_first_page",{},ids(1,25));
verify("price_desc_clamped_page",{sort:"price_desc",limit:1000},ids(100_000,99_940,-1));
verify("price_asc_deep_page",{sort:"price_asc",offset:99_960},ids(99_961,99_985));
verify("price_desc_deep_page",{sort:"price_desc",offset:99_960},ids(40,16,-1));
verify("best_terminal_page",{offset:99_984},ids(99_985,100_000));

const queryPlans=[
 explain("best_first_page",{}),
 explain("price_asc_deep_page",{sort:"price_asc",offset:99_960})
];

console.log(JSON.stringify({
 status:"PASS",
 fixtureCount:Number(psql("select count(*) from public.parts;")),
 migration:"supabase/migrations/20260914103500_single_scan_marketplace_search_candidates.sql",
 scenarios,
 queryPlans,
 verified:[
  "single candidate scan is present in the deployed function definition",
  "all 100k global-order and deep-pagination expectations remain unchanged",
  "full-function EXPLAIN ANALYZE/BUFFERS evidence is recorded after the patch"
 ]
},null,2));
