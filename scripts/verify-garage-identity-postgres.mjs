import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

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
try{
 await Promise.all(clients.map(c=>c.connect()));
 assert.match((await setup.query('show server_version')).rows[0].server_version,/^17\./,'PostgreSQL 17 required');
 assert.equal((await setup.query("select count(*)::int n from pg_tables where schemaname in ('public','private','auth')")).rows[0].n,0,'Database must be empty; no resets or drops.');
 await setup.query(`
  create role anon nologin nosuperuser nobypassrls;
  create role authenticated nologin nosuperuser nobypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to authenticated;
  create table public.profiles(id uuid primary key);
  create table public.vehicle_catalogue_variants(id uuid primary key,provider text,body_type text,make text,model_family text,variant text);
  create table public.vehicle_catalogue_years(variant_id uuid references public.vehicle_catalogue_variants(id),year_first_used smallint,primary key(variant_id,year_first_used));
  create table public.vehicle_catalogue_engines(variant_id uuid references public.vehicle_catalogue_variants(id),fuel_type text,engine_size_simple integer);
  grant select on public.vehicle_catalogue_variants,public.vehicle_catalogue_years,public.vehicle_catalogue_engines to authenticated;
 `);
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
}finally{
 await Promise.all(clients.map(async c=>{await c.query('rollback').catch(()=>{});await c.end().catch(()=>{});}));
}
