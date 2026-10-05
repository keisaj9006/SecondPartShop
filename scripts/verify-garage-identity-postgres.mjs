import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {garageIdentityFixture} from './lib/garage-identity-fixture.mjs';

const url=process.env.TEST_DATABASE_URL;
if(!url)throw Error('TEST_DATABASE_URL is required for disposable Garage PostgreSQL proof.');
const target=new URL(url);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/secondpart_garage_rc')throw Error('Only the disposable local secondpart_garage_rc database is permitted.');
const pg=await import(process.env.PG_CLIENT_MODULE?pathToFileURL(process.env.PG_CLIENT_MODULE).href:'pg');
const Client=pg.Client??pg.default.Client;
const clients=Array.from({length:3},()=>new Client({connectionString:url,statement_timeout:15000}));
const [setup,a,b]=clients;
const id=n=>'72000000-0000-4000-8000-'+String(n).padStart(12,'0');
const migrations=new URL('../supabase/migrations/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,migrations),'utf8');
const pending=fs.readdirSync(migrations).find(name=>name.endsWith('_garage_vehicle_identity.sql'));
const runMigration=async(sql)=>{await setup.query('begin');try{await setup.query(sql);await setup.query('commit');}catch(error){await setup.query('rollback');throw error;}};
const asOwner=async(client,n)=>{await client.query('set role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);};
const save=async(client,{operation='identity_save',registration='ZZ16ABC',make='HONDA',model='JAZZ',year=2016,fuel='PETROL',engine=1300,variant=null,garage=null}={})=>(await client.query(
 'select * from public.save_garage_vehicle_v1($1,$2,$3,$4,$5,$6,$7,null,null,$8,$9)',
 [operation,registration,make,model,year,fuel,engine,variant,garage]
)).rows[0];
async function waitForLock(pid){
 const until=Date.now()+5000;
 while(Date.now()<until){
  if((await setup.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 throw Error('Second connection never reached expected database lock');
}
try{
 await Promise.all(clients.map(c=>c.connect()));
 assert.match((await setup.query('show server_version')).rows[0].server_version,/^17\./,'PostgreSQL 17 required');
 assert.equal((await setup.query("select count(*)::int n from pg_tables where schemaname in ('public','private','auth')")).rows[0].n,0,'Database must be empty; no resets or drops.');
 await setup.query(garageIdentityFixture);
 await setup.query('insert into profiles values($1),($2)',[id(1),id(2)]);
 await setup.query("insert into vehicle_catalogue_variants values($1,'dft','Cars','HONDA','JAZZ','SE'),($2,'dft','Cars','HONDA','JAZZ','SPORT')",[id(10),id(11)]);
 await setup.query('insert into vehicle_catalogue_years values($1,2016),($2,2016)',[id(10),id(11)]);
 await setup.query("insert into vehicle_catalogue_engines values($1,'PETROL',1300),($2,'PETROL',1500)",[id(10),id(11)]);
 await setup.query(read('20260905115601_secondpart_garage.sql'));
 await setup.query(read('20260906133500_garage_vehicle_colour.sql'));
 await setup.query('insert into garage_vehicles(id,profile_id,catalogue_variant_id,year,registration) values($1,$2,$3,2016,\'AB16CDE\')',[id(20),id(1),id(10)]);
 // A collision must prevent the migration, preserving the old constraint and rows.
 await setup.query('begin');
 await setup.query("insert into garage_vehicles(profile_id,catalogue_variant_id,year,registration) values($1,$2,2016,'AB16CDE')",[id(1),id(11)]);
 await assert.rejects(setup.query(read(pending)),/collisions.*corrective/i);
 await setup.query('rollback');
 assert.equal((await setup.query("select is_nullable from information_schema.columns where table_name='garage_vehicles' and column_name='catalogue_variant_id'")).rows[0].is_nullable,'NO');
 await runMigration(read(pending));
 assert.equal((await setup.query("select count(*)::int n from pg_constraint where conrelid='public.garage_vehicles'::regclass and contype='f'")).rows[0].n,2);
 await asOwner(a,1);await asOwner(b,2);
 await a.query("insert into garage_vehicles(id,profile_id,year,registration,identity_make,identity_model) values($1,$2,2021,'ZZ21ABC','RENAULT','TRAFIC')",[id(21),id(1)]);
 const rows=await a.query('select g.*,v.variant from garage_vehicles g left join vehicle_catalogue_variants v on v.id=g.catalogue_variant_id order by g.id');
 assert.equal(rows.rows.length,2);assert.equal(rows.rows[1].catalogue_variant_id,null);assert.equal(rows.rows[1].identity_model,'TRAFIC');
 assert.equal((await b.query('select * from garage_vehicles')).rowCount,0);
 assert.equal((await b.query("update garage_vehicles set nickname='stolen' where id=$1",[id(21)])).rowCount,0);
 assert.equal((await b.query('delete from garage_vehicles where id=$1',[id(21)])).rowCount,0);
 await assert.rejects(b.query("insert into garage_vehicles(profile_id,year,registration,identity_make,identity_model) values($1,2021,'ZZ21DEF','RENAULT','TRAFIC')",[id(1)]),/row-level security/i);
 await assert.rejects(a.query("insert into garage_vehicles(profile_id,year,registration,identity_make,identity_model) values($1,2021,'ZZ21GHI',$2,'TRAFIC')",[id(1),'x'.repeat(81)]),/check constraint/i);
 console.log('PASS nullable FK, legacy/identity left reads, bounds, collision stop, owner SELECT/INSERT/UPDATE/DELETE');
 const normalized=await save(a,{registration:'zz16 abc'});
 assert.equal(normalized.outcome,'created');
 assert.equal((await save(a,{registration:'ZZ16ABC'})).garage_vehicle_id,normalized.garage_vehicle_id);
 assert.equal((await save(a,{registration:'ZZ16ABC'})).outcome,'already_exists');
 for(const whitespace of ['\t','\n','\u00a0','\u2007','\u202f','\ufeff'])assert.equal((await save(a,{registration:'zz16'+whitespace+'abc'})).garage_vehicle_id,normalized.garage_vehicle_id);
 // No arbitrary derivative selection; the explicit ID is mandatory.
 assert.equal((await save(a,{operation:'enrich_exact',garage:normalized.garage_vehicle_id})).outcome,'reselect_required');
 for(const overrides of [{make:'FORD'},{model:'CIVIC'},{year:2017},{fuel:'DIESEL'},{engine:1500}]){
  const rejected=await save(a,{operation:'enrich_exact',variant:id(10),garage:normalized.garage_vehicle_id,...overrides});
  assert.equal(rejected.outcome,'reselect_required');
 }
 // Saved reliable identity cannot be bypassed by omitting submitted optional data.
 assert.equal((await save(a,{operation:'enrich_exact',variant:id(11),garage:normalized.garage_vehicle_id,fuel:null,engine:null})).outcome,'reselect_required');
 assert.equal((await save(b,{operation:'enrich_exact',variant:id(10),garage:normalized.garage_vehicle_id})).outcome,'reselect_required');
 const enrichment=await save(a,{operation:'enrich_exact',variant:id(10),garage:normalized.garage_vehicle_id});
 assert.equal(enrichment.outcome,'enriched');assert.equal(enrichment.catalogue_variant_id,id(10));
 assert.equal((await save(a)).catalogue_variant_id,id(10),'identity retry must not downgrade');
 assert.equal((await save(a,{operation:'enrich_exact',variant:id(11),engine:1500})).outcome,'reselect_required');
 console.log('PASS normalization/duplicates, missing/invalid/conflicting exact profile, saved optional evidence and owner isolation');

 // Both independent sessions now act as the same owner for real overlap races.
 await asOwner(b,1);
 const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
 await a.query('begin');
 const first=await save(a,{registration:'ZZ16DEF'});
 const secondSave=save(b,{registration:'zz16 def'});await waitForLock(pid);await a.query('commit');
 const second=await secondSave;
 assert.equal(second.outcome,'already_exists');assert.equal(first.garage_vehicle_id,second.garage_vehicle_id);
 assert.equal((await setup.query("select count(*)::int n from garage_vehicles where profile_id=$1 and registration='ZZ16DEF'",[id(1)])).rows[0].n,1);
 console.log('PASS concurrent normalized duplicate saves converge to one Garage ID');

 for(const [n,identityFirst] of [[1,true],[2,false]]){
  const registration='ZZ16'+(n===1?'GHI':'JKL');
  const identity=await save(a,{registration});
  const options={registration,garage:identity.garage_vehicle_id,operation:'enrich_exact',variant:id(10)};
  await a.query('begin');
  if(identityFirst)await save(a,{registration});else await save(a,options);
  const competing=identityFirst?save(b,options):save(b,{registration});
  await waitForLock(pid);await a.query('commit');await competing;
  assert.equal((await setup.query('select catalogue_variant_id from garage_vehicles where id=$1',[identity.garage_vehicle_id])).rows[0].catalogue_variant_id,id(10));
  assert.equal((await save(a,{registration})).catalogue_variant_id,id(10));
 }
 console.log('PASS both identity/enrichment transaction orderings preserve confirmed profile; subsequent identity retry cannot downgrade');

 // Two explicitly confirmed variants sharing all reliable identity evidence:
 // row locking commits one confirmed profile and returns a reselect result for
 // the conflicting writer; it never silently changes an existing exact choice.
 await setup.query("insert into vehicle_catalogue_variants values($1,'dft','Cars','HONDA','JAZZ','ALTERNATIVE')",[id(12)]);
 await setup.query('insert into vehicle_catalogue_years values($1,2016)',[id(12)]);
 await setup.query("insert into vehicle_catalogue_engines values($1,'PETROL',1300)",[id(12)]);
 const ambiguous=await save(a,{registration:'ZZ16MNO'});
 await a.query('begin');
 const chosen=await save(a,{registration:'ZZ16MNO',garage:ambiguous.garage_vehicle_id,operation:'enrich_exact',variant:id(10)});
 const competingChoice=save(b,{registration:'ZZ16MNO',garage:ambiguous.garage_vehicle_id,operation:'enrich_exact',variant:id(12)});
 await waitForLock(pid);await a.query('commit');
 assert.equal(chosen.outcome,'enriched');assert.equal((await competingChoice).outcome,'reselect_required');
 assert.equal((await save(a,{registration:'ZZ16MNO'})).catalogue_variant_id,id(10));
 await setup.query('set role anon');
 await assert.rejects(save(setup),/permission denied/i);await setup.query('reset role');
 console.log('PASS conflicting explicit enrichment cannot overwrite confirmed choice; anonymous RPC execution denied');
 const providerFuel=await save(a,{registration:'ZZ16PQR',fuel:'Petrol'});
 assert.equal((await save(a,{registration:'ZZ16PQR',garage:providerFuel.garage_vehicle_id,operation:'enrich_exact',variant:id(10)})).outcome,'enriched');
 assert.equal((await setup.query('select fuel_type from garage_vehicles where id=$1',[providerFuel.garage_vehicle_id])).rows[0].fuel_type,'PETROL');
 await save(a,{registration:'ZZ16PQR',fuel:'Petrol'});
 assert.equal((await setup.query('select fuel_type from garage_vehicles where id=$1',[providerFuel.garage_vehicle_id])).rows[0].fuel_type,'PETROL');
 console.log('PASS explicit enrichment stores catalogue fuel spelling and identity retry preserves it');
}finally{
 await Promise.all(clients.map(async c=>{await c.query('rollback').catch(()=>{});await c.end().catch(()=>{});}));
}
