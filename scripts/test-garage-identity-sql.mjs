import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {garageIdentityFixture} from './lib/garage-identity-fixture.mjs';
const migrations=new URL('../supabase/migrations/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,migrations),'utf8');
const pending=fs.readdirSync(migrations).find(name=>name.endsWith('_garage_vehicle_identity.sql'));
const id=n=>'72000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('real Garage migration and atomic save run on a reduced PostgreSQL schema',async t=>{
 const db=new PGlite();
 async function owner(n,sql,args=[]){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);await db.exec('set role authenticated');try{return await db.query(sql,args);}finally{await db.exec('reset role');}}
 async function save({operation='identity_save',registration='AB16CDE',make='HONDA',model='JAZZ',year=2016,fuel='PETROL',engine=1300,variant=null,garage=null,actor=1}={}){return (await owner(actor,'select * from public.save_garage_vehicle_v1($1,$2,$3,$4,$5,$6,$7,null,null,$8,$9)',[operation,registration,make,model,year,fuel,engine,variant,garage])).rows[0];}
 try{
  await db.exec(garageIdentityFixture);
  await db.query('insert into profiles values($1),($2)',[id(1),id(2)]);
  await db.query("insert into vehicle_catalogue_variants values($1,'dft','Cars','HONDA','JAZZ','SE'),($2,'dft','Cars','HONDA','JAZZ','ALT'),($3,'dft','Cars','HONDA','CIVIC','SE')",[id(10),id(11),id(12)]);
  await db.query('insert into vehicle_catalogue_years values($1,2016),($2,2016),($3,2016)',[id(10),id(11),id(12)]);
  await db.query("insert into vehicle_catalogue_engines values($1,'PETROL',1300),($2,'DIESEL',1600),($3,'PETROL',1300)",[id(10),id(11),id(12)]);
  await db.exec(read('20260905115601_secondpart_garage.sql'));
  await db.exec(read('20260906133500_garage_vehicle_colour.sql'));
  await db.query("insert into garage_vehicles(profile_id,catalogue_variant_id,year,registration) values($1,$2,2016,'ZZ99ZZZ')",[id(1),id(10)]);
  await t.test('pre-existing registration collisions halt migration without deleting or merging rows',async()=>{
   await db.exec('begin');
   await db.query("insert into garage_vehicles(profile_id,catalogue_variant_id,year,registration) values($1,$2,2016,'ZZ99ZZZ')",[id(1),id(11)]);
   await assert.rejects(db.exec(read(pending)),/collisions.*corrective/i);
   await db.exec('rollback');
   assert.equal((await db.query("select count(*)::int n from garage_vehicles where registration='ZZ99ZZZ'")).rows[0].n,1);
   assert.equal((await db.query("select is_nullable from information_schema.columns where table_name='garage_vehicles' and column_name='catalogue_variant_id'")).rows[0].is_nullable,'NO');
  });
  await db.exec('begin');await db.exec(read(pending));await db.exec('commit');
  let identity;
  await t.test('identity creates without derivative and normalized duplicate reuses ID',async()=>{
   identity=await save({registration:'ab16 cde'});assert.equal(identity.outcome,'created');assert.equal(identity.catalogue_variant_id,null);
   const duplicate=await save();assert.equal(duplicate.outcome,'already_exists');assert.equal(duplicate.garage_vehicle_id,identity.garage_vehicle_id);
   assert.equal((await db.query("select count(*)::int n from garage_vehicles where registration='AB16CDE'")).rows[0].n,1);
  });
  await t.test('SQL normalizes the complete JavaScript whitespace set for registration duplicates',async()=>{
   for(const whitespace of ['\t','\n','\u00a0','\u2007','\u202f','\ufeff']){
    const duplicate=await save({registration:'ab16'+whitespace+'cde'});
    assert.equal(duplicate.garage_vehicle_id,identity.garage_vehicle_id);
   }
  });
  await t.test('owner isolation covers reads, direct mutations and supplied enrichment IDs',async()=>{
   assert.equal((await owner(2,'select * from garage_vehicles')).rows.length,0);
   assert.equal((await owner(2,"update garage_vehicles set nickname='stolen' where id=$1 returning id",[identity.garage_vehicle_id])).rows.length,0);
   assert.equal((await save({operation:'enrich_exact',variant:id(10),garage:identity.garage_vehicle_id,actor:2})).outcome,'reselect_required');
  });
  await t.test('enrichment rejects conflicting make/model/year/fuel/capacity and no arbitrary choice',async()=>{
   assert.equal((await save({operation:'enrich_exact',garage:identity.garage_vehicle_id})).outcome,'reselect_required');
   for(const overrides of [{make:'FORD'},{model:'CIVIC'},{year:2017},{fuel:'DIESEL'},{engine:1600},{variant:id(11),fuel:null,engine:null},{variant:id(12)}])assert.equal((await save({operation:'enrich_exact',variant:id(10),garage:identity.garage_vehicle_id,...overrides})).outcome,'reselect_required');
   assert.equal((await db.query('select catalogue_variant_id from garage_vehicles where id=$1',[identity.garage_vehicle_id])).rows[0].catalogue_variant_id,null);
  });
  await t.test('explicit confirmed enrichment survives every later identity retry',async()=>{
   const enriched=await save({operation:'enrich_exact',variant:id(10),garage:identity.garage_vehicle_id});assert.equal(enriched.outcome,'enriched');assert.equal(enriched.catalogue_variant_id,id(10));
   for(let i=0;i<3;i++)assert.equal((await save()).catalogue_variant_id,id(10));
   assert.equal((await save({operation:'enrich_exact',variant:id(11),fuel:'DIESEL',engine:1600})).outcome,'reselect_required');
   assert.equal((await db.query('select catalogue_variant_id from garage_vehicles where id=$1',[identity.garage_vehicle_id])).rows[0].catalogue_variant_id,id(10));
  });
  await t.test('manual catalogue profile without registration remains representable',async()=>{
   const manual=await save({operation:'enrich_exact',registration:null,variant:id(10)});assert.equal(manual.outcome,'created');
   assert.equal((await save({operation:'enrich_exact',registration:null,variant:id(10)})).outcome,'already_exists');
   assert.equal((await save({operation:'enrich_exact',registration:null,variant:id(10),fuel:'Petrol'})).outcome,'already_exists');
  });
  await t.test('enrichment stores canonical catalogue fuel so exact readers can resolve a DVSA label',async()=>{
   const saved=await save({registration:'ZZ16PQR',fuel:'Petrol'});
   const enriched=await save({registration:'ZZ16PQR',garage:saved.garage_vehicle_id,operation:'enrich_exact',variant:id(10),fuel:'PETROL'});
   assert.equal(enriched.outcome,'enriched');
   assert.equal((await db.query('select fuel_type from garage_vehicles where id=$1',[saved.garage_vehicle_id])).rows[0].fuel_type,'PETROL');
   await save({registration:'ZZ16PQR',fuel:'Petrol'});
   assert.equal((await db.query('select fuel_type from garage_vehicles where id=$1',[saved.garage_vehicle_id])).rows[0].fuel_type,'PETROL');
  });
  await t.test('legacy catalogue rows and identity snapshots survive optional reads with FK and bounds intact',async()=>{
   await owner(1,'insert into garage_vehicles(profile_id,catalogue_variant_id,year) values($1,$2,2016)',[id(1),id(12)]);
   await save({registration:'ZZ21ABC',make:'RENAULT',model:'TRAFIC',year:2021,fuel:'DIESEL',engine:1600});
   const rows=(await owner(1,'select g.catalogue_variant_id,g.identity_make,g.identity_model,v.variant from garage_vehicles g left join vehicle_catalogue_variants v on g.catalogue_variant_id=v.id')).rows;
   assert.ok(rows.some(r=>r.catalogue_variant_id===id(12)&&r.identity_make===null&&r.variant==='SE'));
   assert.ok(rows.some(r=>r.catalogue_variant_id===null&&r.identity_model==='TRAFIC'&&r.variant===null));
   assert.equal((await db.query("select count(*)::int n from pg_constraint where conrelid='public.garage_vehicles'::regclass and contype='f'")).rows[0].n,2);
   await assert.rejects(owner(1,"insert into garage_vehicles(profile_id,year,registration) values($1,2021,'ZZ21DEF')",[id(1)]),/check constraint/i);
  });
  await t.test('SQL rejects invalid identity bounds and anonymous execute permission',async()=>{
   await assert.rejects(save({make:'x'.repeat(81)}),/Invalid vehicle identity/);
   await db.exec('set role anon');try{await assert.rejects(db.query("select * from save_garage_vehicle_v1('identity_save')"),/permission denied/i);}finally{await db.exec('reset role');}
  });
  t.diagnostic('PGlite is reduced PostgreSQL 18; PostgreSQL 17 independent-connection race proof remains a separate CI gate.');
 }finally{await db.close();}
});
