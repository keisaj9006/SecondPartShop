import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const databaseUrl=process.env.TEST_DATABASE_URL;
if(!databaseUrl)throw new Error("TEST_DATABASE_URL is required for candidate-strategy diagnostics.");

function psql(sql){
 const result=spawnSync("psql",[databaseUrl,"-X","-qAt","-v","ON_ERROR_STOP=1"],{
  input:sql,encoding:"utf8",maxBuffer:32*1024*1024
 });
 if(result.status!==0)throw new Error((result.stderr||result.stdout||"psql failed").trim());
 return (result.stdout||"").trim();
}

function queryParts(rawQuery){
 const safe=rawQuery.replaceAll("'","''");
 return `
with recursive category_ancestors as (
 select c.id category_id,c.parent_id,pg_catalog.concat_ws(' ',c.name,c.slug,pg_catalog.array_to_string(c.search_terms,' ')) searchable
 from public.categories c
 union all
 select child.category_id,parent.parent_id,pg_catalog.concat_ws(' ',child.searchable,parent.name,parent.slug)
 from category_ancestors child join public.categories parent on parent.id=child.parent_id
),
category_search as (
 select category_id,pg_catalog.string_agg(searchable,' ') searchable from category_ancestors group by category_id
),
q as (
 select '${safe}'::text raw_query,
        lower('${safe}') lower_query,
        regexp_replace(lower('${safe}'),'[^a-z0-9]','','g') compact_query,
        websearch_to_tsquery('english','${safe}') ts_query
),
eligible as not materialized (
 select p.* from public.parts p join public.sellers s on s.id=p.seller_id
 where p.status='active'::public.listing_status and s.account_deleted_at is null
)
`;
}

const predicates={
 fts:"p.search_document@@q.ts_query",
 title:"lower(p.title) like '%'||q.lower_query||'%'",
 manufacturer:"lower(coalesce(p.manufacturer,'')) like '%'||q.lower_query||'%'",
 oem:"p.oem_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.oem_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%'",
 partNumber:"p.part_number is not null and q.compact_query<>'' and regexp_replace(lower(coalesce(p.part_number,'')),'[^a-z0-9]','','g') like '%'||q.compact_query||'%'",
 gearboxCode:"p.gearbox_code is not null and lower(coalesce(p.gearbox_code,'')) like '%'||q.lower_query||'%'",
 gearboxFamily:"p.gearbox_family is not null and lower(coalesce(p.gearbox_family,'')) like '%'||q.lower_query||'%'",
 category:"p.category_id in (select category_id from category_search where lower(searchable) like '%'||q.lower_query||'%')"
};

function strategySql(rawQuery,strategy,explain=false){
 const prefix=queryParts(rawQuery);
 const predicateList=Object.values(predicates);
 const candidate=strategy==="union"
  ?`candidate_ids as (\n${predicateList.map(predicate=>` select p.id from eligible p cross join q where q.raw_query<>'' and ${predicate}`).join("\n union\n")}\n)`
  :`candidate_ids as (\n select p.id from eligible p cross join q where q.raw_query<>'' and (\n  ${predicateList.join("\n  or ")}\n )\n)`;
 const statement=`${prefix},\n${candidate}\nselect count(*) from candidate_ids;`;
 return explain?`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${statement}`:statement;
}

function explain(rawQuery,strategy){
 const text=psql(strategySql(rawQuery,strategy,true));
 const document=JSON.parse(text);
 const statement=document[0];
 const plan=statement.Plan;
 return {
  executionTimeMs:statement["Execution Time"],
  planningTimeMs:statement["Planning Time"],
  sharedHitBlocks:plan["Shared Hit Blocks"]??0,
  sharedReadBlocks:plan["Shared Read Blocks"]??0
 };
}

function measure(rawQuery){
 const unionCount=Number(psql(strategySql(rawQuery,"union")));
 const singleScanCount=Number(psql(strategySql(rawQuery,"single")));
 assert.equal(singleScanCount,unionCount,`${rawQuery}: candidate strategies must produce the same complete candidate set`);
 return {
  query:rawQuery,
  candidateCount:unionCount,
  union:explain(rawQuery,"union"),
  singleScan:explain(rawQuery,"single")
 };
}

const broad=measure("Scale alternator");
const narrow=measure("SCALEOEM100000");

console.log(JSON.stringify({
 status:"DIAGNOSTIC_ONLY",
 scope:"isolated PostgreSQL 17 fixture; no production function changed",
 broad,
 narrow
},null,2));
