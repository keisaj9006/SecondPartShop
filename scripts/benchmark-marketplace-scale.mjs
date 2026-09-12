import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {database,id,migration} from './lib/marketplace-search-sql-harness.mjs';

const fixtureCount=25_000;
const queryText='Scale alternator';
const migrationName='20260912110440_complete_marketplace_search_page.sql';
const migrationPath=`supabase/migrations/${migrationName}`;
const pglitePackage=JSON.parse(fs.readFileSync(new URL('../node_modules/@electric-sql/pglite/package.json',import.meta.url),'utf8'));
const elapsed=start=>Number((performance.now()-start).toFixed(1));
const ids=(from,to,step=1)=>{
 const values=[];
 for(let value=from;step>0?value<=to:value>=to;value+=step)values.push(id(value));
 return values;
};

async function seedScaleFixture(db){
 await db.exec(`insert into auth.users values ('${id(9001)}');
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
 from generate_series(1,${fixtureCount}) n;`);
}

async function runScaleProbe(){
 const totalStart=performance.now();
 const bootstrapStart=performance.now();
 const db=await database();
 const bootstrapMs=elapsed(bootstrapStart);
 const queries=[];
 try{
  const runtime=(await db.query("select version(),(select extversion from pg_extension where extname='pg_trgm') trgm")).rows[0];
  const migrationSql=migration(migrationName);
  const migrationSha256=crypto.createHash('sha256').update(migrationSql).digest('hex');

  const seedStart=performance.now();
  await seedScaleFixture(db);
  const seedMs=elapsed(seedStart);
  const actualCount=(await db.query('select count(*)::integer count from public.parts')).rows[0].count;
  assert.equal(actualCount,fixtureCount,'the isolated scale fixture contains exactly 25,000 listings');

  const migrationStart=performance.now();
  await db.exec(migrationSql);
  const migrationMs=elapsed(migrationStart);
  const analyzeStart=performance.now();
  await db.exec('analyze public.parts');
  const analyzeMs=elapsed(analyzeStart);

  const measure=async({name,query=queryText,sort='best',categoryIds=null,limit=24,offset=0,expectedIds})=>{
   const queryStart=performance.now();
   const result=await db.query(
    `select * from marketplace_search_page_v1(
      p_query=>$1::text,
      p_sort=>$2::text,
      p_limit=>$3::integer,
      p_offset=>$4::integer,
      p_category_ids=>$5::uuid[]
    )`,
    [query,sort,limit,offset,categoryIds]
   );
   const durationMs=elapsed(queryStart);
   assert.ok(result.rows.length<=Math.min(Math.max(limit,1),60)+1,`${name} stays within the bounded page plus sentinel`);
   assert.deepEqual(result.rows.map(row=>row.part_id),expectedIds,`${name} preserves global order before pagination`);
   queries.push({
    name,
    query,
    sort,
    categoryIds,
    limit,
    offset,
    rowCount:result.rows.length,
    firstPartId:result.rows[0]?.part_id??null,
    lastPartId:result.rows.at(-1)?.part_id??null,
    durationMs
   });
  };

  await measure({name:'filtered_compact_oem',query:'SCALEOEM25000',categoryIds:[id(7002)],expectedIds:[id(25_000)]});
  await measure({name:'best_first_page',expectedIds:ids(1,25)});
  await measure({name:'price_desc_clamped_page',sort:'price_desc',limit:1000,expectedIds:ids(25_000,24_940,-1)});
  await measure({name:'price_asc_deep_page',sort:'price_asc',offset:24_960,expectedIds:ids(24_961,24_985)});
  await measure({name:'price_desc_deep_page',sort:'price_desc',offset:24_960,expectedIds:ids(40,16,-1)});
  await measure({name:'best_terminal_page',offset:24_984,expectedIds:ids(24_985,25_000)});

  return {
   fixtureCount:actualCount,
   status:'PASS',
   scope:{fixture:'isolated in-memory PGlite',sharedSupabaseWrites:0},
   runtime:{
    node:process.version,
    platform:process.platform,
    architecture:process.arch,
    logicalCpuCount:os.cpus().length,
    pglite:pglitePackage.version,
    postgresql:runtime.version,
    pgTrgm:runtime.trgm,
    rssMiB:Number((process.memoryUsage().rss/1024/1024).toFixed(1))
   },
   migration:{path:migrationPath,sha256:migrationSha256},
   timingsMs:{bootstrap:bootstrapMs,seed:seedMs,migration:migrationMs,analyze:analyzeMs,queries,total:elapsed(totalStart)},
   verified:[
   'exactly 25,000 synthetic listings',
   'current checked-in search migration loaded unchanged',
    'compact OEM matching under a category filter',
   'bounded limit-plus-one pages',
    'global best and price ordering before pagination',
    'deep and terminal pagination behavior'
   ]
  };
 }finally{
  await db.close();
 }
}

const report=await runScaleProbe();
assert.equal(report.fixtureCount,25_000,'scale probe verifies exactly 25,000 listings');
console.log(JSON.stringify(report,null,2));
