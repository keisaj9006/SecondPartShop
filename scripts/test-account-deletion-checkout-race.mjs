import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';

const root=path.resolve(import.meta.dirname,'..');
const baseline=process.argv.includes('--baseline');
const postgresMode=process.argv.includes('--postgres');
const fittingBaseline=process.argv.includes('--fitting-baseline');
const responseBaseline=process.argv.includes('--response-baseline');
const messageBaseline=process.argv.includes('--message-baseline');
const stranger='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const garage='55555555-5555-4555-8555-555555555555';
const variant='66666666-6666-4666-8666-666666666666';
const garageOwner='77777777-7777-4777-8777-777777777777';
const garageRequest='88888888-8888-4888-8888-888888888888';
const buyerGarage='99999999-0000-4000-8000-000000000000';
const uid='11111111-1111-4111-8111-111111111111';
const seller='22222222-2222-4222-8222-222222222222';
const part='33333333-3333-4333-8333-333333333333';
const request='44444444-4444-4444-8444-444444444444';
const proposal=path.join(root,'docs/test-runs/2026-10-08-deletion-checkout-guard.sql');
function sqlFunction(file,name){
 const source=fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8');
 const start=source.indexOf('create or replace function '+name);
 assert.ok(start>=0,name);
 const end=source.indexOf('$$;',source.indexOf('as $$',start));
 assert.ok(end>start,name);
 return source.slice(start,end+3);
}
async function buildDatabase(){
 let db;
 if(postgresMode){
  if(baseline)throw new Error('Real contention proof requires the candidate proposal.');
  const url=process.env.TEST_DATABASE_URL;
  if(!url)throw new Error('Disposable local PostgreSQL TEST_DATABASE_URL required.');
  const target=new URL(url);
  if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/secondpart_deletion_rc')throw new Error('Disposable local secondpart_deletion_rc required.');
  const pg=process.env.PG_CLIENT_MODULE?await import(pathToFileURL(process.env.PG_CLIENT_MODULE).href):await import('pg');
  const Client=pg.Client??pg.default.Client;
  const client=new Client({connectionString:url,statement_timeout:15000});
  await client.connect();
  db={query:(sql,args)=>client.query(sql,args),exec:sql=>client.query(sql),close:()=>client.end(),Client,url};
  const tableCount=Number((await db.query("select count(*) n from pg_tables where schemaname in ('public','private','auth','storage')")).rows[0].n);
  if(tableCount!==0){await db.close();throw new Error('An empty disposable database is required.');}
  const version=Number((await db.query("select current_setting('server_version_num') version")).rows[0].version);
  if(version<170000||version>=180000){await db.close();throw new Error('PostgreSQL 17 is required for the release contention gate.');}
 }else db=new PGlite();
 await db.exec(`
 create schema auth; create schema private; create schema storage;
 do $$begin
  if not exists(select 1 from pg_roles where rolname='anon')then create role anon;end if;
  if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated;end if;
  if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role;end if;
 end$$;
 create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
 create type public.listing_status as enum('active','reserved','archived');
 create table auth.users(id uuid primary key);
 create table profiles(id uuid primary key references auth.users(id) on delete cascade);
 create table sellers(id uuid primary key, owner_id uuid, business_name text, seller_type text, slug text, location text, verified_at timestamptz, postcode text,latitude float,longitude float,postcode_geocoded_at timestamptz,postcode_geocode_approximate boolean,description text,account_deleted_at timestamptz);
 create table garage_partners(id uuid primary key,owner_id uuid,business_name text,slug text,status text,verified_at timestamptz,postcode text,location text,latitude float,longitude float,description text,customer_supplied_parts boolean default true,recycled_parts boolean default true);
 create table parts(id uuid primary key,title text,price_pence integer,stock integer,status listing_status,shipping_pence integer,collection_available boolean,seller_id uuid);
 create table commerce_settings(singleton boolean,platform_fee_bps integer,checkout_reservation_minutes integer);
 create table orders(id uuid primary key default gen_random_uuid(),buyer_id uuid references profiles(id) on delete set null,status text,total_pence integer,currency text,subtotal_pence integer,shipping_pence integer,platform_fee_pence integer,payment_status text,payment_provider text,checkout_expires_at timestamptz,provider_checkout_session_id text,shipping_name text,shipping_address jsonb);
 create table order_items(id uuid primary key default gen_random_uuid(),order_id uuid,part_id uuid,seller_id uuid,quantity integer,unit_price_pence integer,fulfilment_status text,delivery_method text,shipping_pence integer,platform_fee_pence integer,seller_net_pence integer,payout_status text,payout_rollback_required boolean default false);
 create table order_events(order_id uuid,order_item_id uuid,actor_profile_id uuid,event_type text,to_status text,metadata jsonb);
 create table account_deletion_requests(id uuid primary key,profile_id uuid references profiles(id) on delete set null,target_profile_id uuid,status text,cleanup_seller_ids uuid[] default '{}',cleanup_garage_partner_ids uuid[] default '{}',blocker_code text,processing_started_at timestamptz,updated_at timestamptz,reason text,last_error text,completed_at timestamptz,attempt_count integer default 0);
 create table transaction_cases(id uuid,order_item_id uuid,status text);
 create table fitting_requests(id uuid primary key default gen_random_uuid(),buyer_id uuid references profiles(id) on delete set null,garage_partner_id uuid,status text default 'requested',vehicle_registration text,buyer_notes text,part_id uuid,vehicle_variant_id uuid,vehicle_year smallint,vehicle_fuel text,vehicle_engine_size integer,quote_pence integer,quote_note text,quoted_at timestamptz,completed_at timestamptz,buyer_responded_at timestamptz);
 create table fitting_request_messages(id uuid primary key default gen_random_uuid(),fitting_request_id uuid not null references fitting_requests(id) on delete cascade,sender_profile_id uuid not null references profiles(id) on delete cascade,body text not null check(char_length(btrim(body)) between 1 and 2000));
 create table vehicle_catalogue_years(variant_id uuid,year_first_used smallint);
 create table vehicle_catalogue_engines(variant_id uuid,fuel_type text,engine_size_simple integer);
 create table notifications(profile_id uuid,type text,title text,body text,href text,dedupe_key text unique);
 create function private.is_admin() returns boolean language sql as $$select false$$;
 create table marketplace_reports(id uuid,status text,reporter_id uuid,reported_profile_id uuid,seller_id uuid);
 create table listing_conversations(buyer_id uuid,seller_id uuid);
 create table transaction_reviews(reviewer_id uuid,reviewee_id uuid);
 create table part_images(part_id uuid,storage_path text);
 create table seller_payment_accounts(seller_id uuid);
 create table donor_vehicles(seller_id uuid,registration text,notes text);
 create table seller_inventory_imports(seller_id uuid,filename text,error_summary jsonb);
 create table private.part_image_cleanup(owner_id uuid,seller_id uuid,completed_at timestamptz);
 create table storage.objects(bucket_id text,name text);
 create function seller_checkout_ready(uuid) returns boolean language sql as $$select true$$;
 insert into auth.users values('${uid}'); insert into profiles values('${uid}');
 insert into sellers(id,owner_id,business_name) values('${seller}','99999999-9999-4999-8999-999999999999','QA seller');
 insert into parts values('${part}','QA part',500,1,'active',0,true,'${seller}');
 insert into commerce_settings values(true,0,30);
 insert into garage_partners(id,owner_id,status) values('${garage}','${garageOwner}','active');
 insert into garage_partners(id,owner_id,status) values('${buyerGarage}','${uid}','active');
 insert into vehicle_catalogue_years values('${variant}',2020);
 insert into account_deletion_requests(id,profile_id,target_profile_id,status) values('${request}','${uid}','${uid}','processing');
 `);

 await db.exec(sqlFunction('20260906163000_checkout_reservation_lifecycle.sql','public.prepare_checkout_order('));
 await db.exec(sqlFunction('20260909234500_account_deletion_buy_fit_guard.sql','private.account_deletion_blocker('));
 await db.exec(sqlFunction('20260909233000_account_deletion_retry_context.sql','public.claim_account_deletion_request('));
 await db.exec(sqlFunction('20260912215057_account_deletion_seller_minimization.sql','public.prepare_claimed_account_deletion('));
 await db.exec(sqlFunction('20260911213522_secure_part_image_cleanup.sql','public.complete_account_deletion_request('));
 await db.exec(sqlFunction('20260907181459_buy_fit_foundation.sql','public.request_part_fitting_quote('));
 await db.exec(sqlFunction('20260907181459_buy_fit_foundation.sql','public.buyer_respond_fitting_quote('));
 await db.exec(sqlFunction('20260907181459_buy_fit_foundation.sql','public.garage_respond_fitting_request('));
 await db.exec(sqlFunction('20260907183900_buy_fit_messages.sql','public.send_fitting_request_message('));
 if(!baseline)await db.exec(fs.readFileSync(proposal,'utf8'));
 if(fittingBaseline)await db.exec(sqlFunction('20260907181459_buy_fit_foundation.sql','public.request_part_fitting_quote('));
 if(responseBaseline)await db.exec(sqlFunction('20260907181459_buy_fit_foundation.sql','public.garage_respond_fitting_request('));
 if(messageBaseline)await db.exec(sqlFunction('20260907183900_buy_fit_messages.sql','public.send_fitting_request_message('));
 return db;
}
async function reset(db,{status='requested',attempt=0}={}){
 await db.exec('truncate orders,order_items,order_events,account_deletion_requests,fitting_requests,fitting_request_messages,notifications');
 await db.query('delete from auth.users where id=$1',[garageOwner]);
 await db.query("update garage_partners set owner_id=$1,status='active' where id=$2",[garageOwner,garage]);
 await db.query("update garage_partners set owner_id=$1,status='active' where id=$2",[uid,buyerGarage]);
 await db.query('insert into auth.users values($1) on conflict do nothing',[uid]);
 await db.query('insert into profiles values($1) on conflict do nothing',[uid]);
 await db.query("update parts set stock=1,status='active' where id=$1",[part]);
 await db.query('insert into account_deletion_requests(id,profile_id,target_profile_id,status,attempt_count) values($1,$2,$2,$3,$4)',[request,uid,status,attempt]);
}
const checkout=db=>db.query('select * from prepare_checkout_order($1,1,$2)',[part,'collection']);
const claim=(db,requestId=request)=>db.query('select * from claim_account_deletion_request($1)',[requestId]);
const fitting=(db,garageId=garage)=>db.query('select request_part_fitting_quote($1,$2,$3,2020::smallint,null,null,null,null) id',[part,garageId,variant]);
async function garageDeletion(db,{status='requested',attempt=0}={}){
 await db.query('insert into auth.users values($1) on conflict do nothing',[garageOwner]);
 await db.query('insert into profiles values($1) on conflict do nothing',[garageOwner]);
 await db.query('insert into account_deletion_requests(id,profile_id,target_profile_id,status,attempt_count) values($1,$2,$2,$3,$4)',[garageRequest,garageOwner,status,attempt]);
}
async function asActor(db,actor,run){
 const value=actor===null?"null::uuid":"'"+actor+"'::uuid";
 await db.exec("create or replace function auth.uid() returns uuid language sql as $$select "+value+"$$");
 try{return await run();}finally{await db.exec("create or replace function auth.uid() returns uuid language sql as $$select '"+uid+"'::uuid$$");}
}
const snapshot=async db=>({orders:Number((await db.query('select count(*) n from orders')).rows[0].n),stock:(await db.query('select stock from parts')).rows[0].stock});
function deletionWorker(db,{operation='checkout'}={}){
 const events=[];let injected=false;let refused=false;
 const admin={
  from(){const q={select(){return q;},eq(){return q;},order(){return q;},range:async()=>({data:[],error:null}),maybeSingle:async()=>({data:(await db.query('select * from account_deletion_requests where id=$1',[request])).rows[0],error:null})};return q;},
  async rpc(name){events.push(name);if(name==='get_account_deletion_part_image_paths')return {data:[],error:null};if(name==='prepare_claimed_account_deletion')return {data:(await db.query('select prepare_claimed_account_deletion($1,$2) value',[request,uid])).rows[0].value,error:null};if(name==='complete_account_deletion_request')return {data:(await db.query('select complete_account_deletion_request($1) value',[request])).rows[0].value,error:null};throw new Error(name);},
  storage:{from(){return {async list(){if(!injected){injected=true;try{if(operation==='fitting'){await fitting(db);events.push('unsafe-fitting');}else{const row=(await checkout(db)).rows[0];await db.query('update orders set provider_checkout_session_id=$1 where id=$2',['cs_test_after_final_preflight',row.order_id]);events.push('unsafe-checkout');}}catch(error){if(!/deletion.*in progress/i.test(error.message))throw error;refused=true;events.push('checkout-refused');}}return {data:[],error:null};}};}},
  auth:{admin:{getUserById:async()=>({data:{user:(await db.query('select * from auth.users where id=$1',[uid])).rows[0]??null},error:null}),deleteUser:async()=>{events.push('auth-delete');await db.query('delete from auth.users where id=$1',[uid]);return {error:null};}}}
 };
 const exports={};const source=fs.readFileSync(path.join(root,'src/lib/account-deletion.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(compiled,{exports,require:name=>name==='@/lib/supabase/admin'?{createSupabaseAdminClient:()=>admin}:name==='@/lib/part-image-cleanup'?{requirePartImageCleanupReady:async()=>{},attemptPartImageCleanup:async()=>true}:{},process});
 return {run:()=>exports.processAccountDeletionRequest(request),events,get refused(){return refused;}};
}

test('checkout, fitting and deletion obey the same claim boundary in actual SQL',async t=>{
 const db=await buildDatabase();
 try{
  await t.test('ordinary requested account retains checkout functionality',async()=>{await reset(db);const row=(await checkout(db)).rows[0];assert.ok(row.order_id);assert.deepEqual(await snapshot(db),{orders:1,stock:0});});
  await t.test('ordinary unclaimed blocked account retains checkout functionality',async()=>{await reset(db,{status:'blocked'});assert.ok((await checkout(db)).rows[0].order_id);});
  await t.test('checkout first makes deletion claim block without detaching identity',async()=>{await reset(db);await checkout(db);const row=(await claim(db)).rows[0];assert.equal(row.claimed,false);assert.equal(row.blocker_code,'buyer_commerce_active');assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,1);assert.equal((await db.query('select status from account_deletion_requests')).rows[0].status,'blocked');});
  await t.test('deletion claim first rejects checkout without taking stock',async()=>{await reset(db);assert.equal((await claim(db)).rows[0].claimed,true);await assert.rejects(checkout(db),/deletion.*in progress/i);assert.deepEqual(await snapshot(db),{orders:0,stock:1});});
  for(const status of ['processing','failed','blocked'])await t.test('claimed '+status+' deletion rejects new obligations',async()=>{await reset(db,{status,attempt:1});await assert.rejects(checkout(db),/deletion.*in progress/i);assert.deepEqual(await snapshot(db),{orders:0,stock:1});});
  await t.test('checkout after final preflight cannot survive Auth hard deletion',async()=>{await reset(db,{status:'processing',attempt:1});const worker=deletionWorker(db);assert.equal((await worker.run()).status,'completed');assert.equal(worker.refused,true,'new checkout must be refused after final preflight');assert.ok(!worker.events.includes('unsafe-checkout'));assert.deepEqual(await snapshot(db),{orders:0,stock:1});assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,0);});
  if(!baseline)await t.test('RPC grants preserve existing caller authority',async()=>{assert.equal((await db.query("select has_function_privilege('authenticated','public.prepare_checkout_order(uuid,integer,text)','execute') allowed")).rows[0].allowed,true);for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.claim_account_deletion_request(uuid)','execute') allowed",[role])).rows[0].allowed,false);assert.equal((await db.query("select has_function_privilege('service_role','public.claim_account_deletion_request(uuid)','execute') allowed")).rows[0].allowed,true);});

  if(!baseline)await t.test('hosted service grant is preserved but an unbound service request cannot buy',async()=>{
   await reset(db);
   assert.equal((await db.query("select has_function_privilege('service_role','public.prepare_checkout_order(uuid,integer,text)','execute') allowed")).rows[0].allowed,true);
   await db.exec('create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$');
   await db.exec('set role service_role');
   try{await assert.rejects(checkout(db),/authentication required/i);}finally{await db.exec('reset role');await db.exec("create or replace function auth.uid() returns uuid language sql as $$select '"+uid+"'::uuid$$");}
   assert.deepEqual(await snapshot(db),{orders:0,stock:1});
  });
  if(!baseline)await t.test('authenticated caller can buy but cannot claim destructive deletion',async()=>{
   await reset(db);await db.exec('set role authenticated');
   try{assert.ok((await checkout(db)).rows[0].order_id);await assert.rejects(claim(db),/permission denied/i);}finally{await db.exec('reset role');}
   await reset(db,{status:'processing',attempt:1});await db.exec('set role authenticated');
   try{await assert.rejects(checkout(db),/deletion.*in progress/i);}finally{await db.exec('reset role');}
   await db.exec('set role anon');
   try{await assert.rejects(checkout(db),/permission denied/i);await assert.rejects(claim(db),/permission denied/i);}finally{await db.exec('reset role');}
  });
  await t.test('ordinary account without deletion request can buy',async()=>{await reset(db);await db.exec('delete from account_deletion_requests');assert.ok((await checkout(db)).rows[0].order_id);});
  await t.test('cancelled unclaimed deletion does not disable checkout',async()=>{await reset(db,{status:'cancelled'});assert.ok((await checkout(db)).rows[0].order_id);});
  await t.test('failed unclaimed deletion does not disable checkout',async()=>{await reset(db,{status:'failed'});assert.ok((await checkout(db)).rows[0].order_id);});
  await t.test('ordinary buyer can request fitting with a requested deletion',async()=>{await reset(db);assert.ok((await fitting(db)).rows[0].id);});
  for(const status of ['requested','quoted','accepted'])await t.test('active fitting '+status+' blocks both participant deletions',async()=>{
   await reset(db);const id=(await fitting(db)).rows[0].id;await db.query('update fitting_requests set status=$1 where id=$2',[status,id]);
   assert.equal((await claim(db)).rows[0].blocker_code,'fitting_request_active');
   await garageDeletion(db);assert.equal((await claim(db,garageRequest)).rows[0].blocker_code,'fitting_request_active');
  });
  await t.test('buyer deletion claim first rejects a new fitting obligation',async()=>{await reset(db);assert.equal((await claim(db)).rows[0].claimed,true);await assert.rejects(fitting(db),/deletion.*in progress/i);assert.equal((await db.query('select count(*)::int n from fitting_requests')).rows[0].n,0);});
  await t.test('garage deletion claim first rejects a new fitting obligation',async()=>{await reset(db);await garageDeletion(db);assert.equal((await claim(db,garageRequest)).rows[0].claimed,true);await assert.rejects(fitting(db),/deletion.*in progress|garage partner.*not available/i);assert.equal((await db.query('select count(*)::int n from fitting_requests')).rows[0].n,0);});
  for(const status of ['processing','failed','blocked'])await t.test('claimed '+status+' buyer deletion rejects fitting creation',async()=>{await reset(db,{status,attempt:1});await assert.rejects(fitting(db),/deletion.*in progress/i);});
  for(const status of ['processing','failed','blocked'])await t.test('claimed '+status+' garage deletion rejects fitting creation',async()=>{await reset(db);await garageDeletion(db,{status,attempt:1});await assert.rejects(fitting(db),/deletion.*in progress/i);});
  await t.test('fitting after final preflight cannot survive Auth hard deletion',async()=>{await reset(db,{status:'processing',attempt:1});const worker=deletionWorker(db,{operation:'fitting'});assert.equal((await worker.run()).status,'completed');assert.equal(worker.refused,true,'new fitting obligation must refuse after final preflight');assert.ok(!worker.events.includes('unsafe-fitting'));assert.equal((await db.query('select count(*)::int n from fitting_requests')).rows[0].n,0);});
  await t.test('terminal fitting requests cannot reopen through quote or acceptance',async()=>{
   for(const status of ['declined','cancelled','completed']){await reset(db);const id=(await fitting(db)).rows[0].id;await db.query('update fitting_requests set status=$1 where id=$2',[status,id]);
    await assert.rejects(db.query("select buyer_respond_fitting_quote($1,'accept')",[id]),/not ready to accept/i);
    await asActor(db,garageOwner,()=>assert.rejects(db.query("select garage_respond_fitting_request($1,'quote',500,null)",[id]),/cannot be quoted/i));
    assert.equal((await claim(db)).rows[0].claimed,true);
   }
  });
  if(!baseline&&!fittingBaseline)await t.test('fitting keeps hosted authenticated/service grants and rejects unbound service',async()=>{
   for(const role of ['authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text)','execute') allowed",[role])).rows[0].allowed,true);
   assert.equal((await db.query("select has_function_privilege('anon','public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text)','execute') allowed")).rows[0].allowed,false);
   await reset(db);await db.exec('create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$');await db.exec('set role service_role');
   try{await assert.rejects(fitting(db),/authentication required/i);}finally{await db.exec('reset role');await db.exec("create or replace function auth.uid() returns uuid language sql as $$select '"+uid+"'::uuid$$");}
  });
  for(const action of ['quote','decline','complete'])await t.test('null-owner '+action+' denies unrelated authenticated caller',async()=>{
   await reset(db);const id=(await fitting(db)).rows[0].id;
   if(action==='complete')await db.query("update fitting_requests set status='accepted' where id=$1",[id]);
   await db.query('update garage_partners set owner_id=null where id=$1',[garage]);
   await asActor(db,stranger,async()=>{await db.exec('set role authenticated');try{await assert.rejects(db.query('select garage_respond_fitting_request($1,$2,500,null)',[id,action]),/fitting request not found/i);}finally{await db.exec('reset role');}});
   assert.equal((await db.query('select status from fitting_requests where id=$1',[id])).rows[0].status,action==='complete'?'accepted':'requested');
  });
  for(const action of ['quote','decline','complete'])await t.test('garage owner retains '+action+' authority',async()=>{
   await reset(db);const id=(await fitting(db)).rows[0].id;
   if(action==='complete')await db.query("update fitting_requests set status='accepted' where id=$1",[id]);
   await asActor(db,garageOwner,async()=>{await db.exec('set role authenticated');try{assert.equal((await db.query('select garage_respond_fitting_request($1,$2,500,null) ok',[id,action])).rows[0].ok,true);}finally{await db.exec('reset role');}});
   assert.equal((await db.query('select status from fitting_requests where id=$1',[id])).rows[0].status,{quote:'quoted',decline:'declined',complete:'completed'}[action]);
  });
  for(const action of ['quote','decline','complete'])await t.test('administrator retains null-owner '+action+' authority',async()=>{
   await reset(db);const id=(await fitting(db)).rows[0].id;
   if(action==='complete')await db.query("update fitting_requests set status='accepted' where id=$1",[id]);
   await db.query('update garage_partners set owner_id=null where id=$1',[garage]);
   await db.exec('create or replace function private.is_admin() returns boolean language sql as $$select true$$');
   try{await asActor(db,stranger,async()=>{await db.exec('set role authenticated');try{assert.equal((await db.query('select garage_respond_fitting_request($1,$2,500,null) ok',[id,action])).rows[0].ok,true);}finally{await db.exec('reset role');}});}finally{await db.exec('create or replace function private.is_admin() returns boolean language sql as $$select false$$');}
  });
  await t.test('anonymous fitting response is denied before mutation',async()=>{
   await reset(db);const id=(await fitting(db)).rows[0].id;
   await asActor(db,null,()=>assert.rejects(db.query("select garage_respond_fitting_request($1,'quote',500,null)",[id]),/authentication required/i));
   assert.equal((await db.query('select status from fitting_requests where id=$1',[id])).rows[0].status,'requested');
  });
  if(!baseline&&!responseBaseline)await t.test('garage response preserves actual hosted execute grants',async()=>{
   for(const role of ['authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.garage_respond_fitting_request(uuid,text,integer,text)','execute') allowed",[role])).rows[0].allowed,true);
   assert.equal((await db.query("select has_function_privilege('anon','public.garage_respond_fitting_request(uuid,text,integer,text)','execute') allowed")).rows[0].allowed,false);
  });
  async function messageFixture({nullBuyer=false,nullOwner=false}={}){
   await reset(db);const id=(await fitting(db)).rows[0].id;
   for(const actor of [garageOwner,stranger]){await db.query('insert into auth.users values($1) on conflict do nothing',[actor]);await db.query('insert into profiles values($1) on conflict do nothing',[actor]);}
   await db.query("update fitting_requests set status='accepted',buyer_id=case when $2 then null else buyer_id end where id=$1",[id,nullBuyer]);
   if(nullOwner)await db.query('update garage_partners set owner_id=null where id=$1',[garage]);
   return id;
  }
  const message=(id)=>db.query('select send_fitting_request_message($1,$2) id',[id,'Synthetic retained-thread regression']);
  for(const [retained,shape] of [['buyer',{nullBuyer:true}],['owner',{nullOwner:true}],['both',{nullBuyer:true,nullOwner:true}]])await t.test('retained null '+retained+' denies unrelated message and notification',async()=>{
   const id=await messageFixture(shape);const before=Number((await db.query('select count(*) n from notifications')).rows[0].n);
   await asActor(db,stranger,async()=>{await db.exec('set role authenticated');try{await assert.rejects(message(id),/fitting request not found/i);}finally{await db.exec('reset role');}});
   assert.equal(Number((await db.query('select count(*) n from fitting_request_messages')).rows[0].n),0);
   assert.equal(Number((await db.query('select count(*) n from notifications')).rows[0].n),before);
  });
  for(const [name,actor,shape,recipient] of [['buyer',uid,{},garageOwner],['garage',garageOwner,{},uid],['retained buyer',uid,{nullOwner:true},null],['retained garage',garageOwner,{nullBuyer:true},null]])await t.test(name+' retains fitting message authority',async()=>{
   const id=await messageFixture(shape);const before=Number((await db.query("select count(*) n from notifications where type='fitting_message'")).rows[0].n);
   await asActor(db,actor,async()=>{await db.exec('set role authenticated');try{assert.ok((await message(id)).rows[0].id);}finally{await db.exec('reset role');}});
   assert.equal((await db.query('select sender_profile_id from fitting_request_messages')).rows[0].sender_profile_id,actor);
   const notices=(await db.query("select profile_id from notifications where type='fitting_message'")).rows;
   assert.equal(notices.length,before+(recipient?1:0));if(recipient)assert.equal(notices[0].profile_id,recipient);
  });
  for(const [retained,shape] of [['buyer',{nullBuyer:true}],['owner',{nullOwner:true}],['both',{nullBuyer:true,nullOwner:true}]])await t.test('administrator retains null '+retained+' fitting message authority',async()=>{
   const id=await messageFixture(shape);await db.exec('create or replace function private.is_admin() returns boolean language sql as $$select true$$');
   try{await asActor(db,stranger,async()=>{await db.exec('set role authenticated');try{assert.ok((await message(id)).rows[0].id);}finally{await db.exec('reset role');}});}finally{await db.exec('create or replace function private.is_admin() returns boolean language sql as $$select false$$');}
  });
  await t.test('unbound fitting message call rejects even administrator',async()=>{
   const id=await messageFixture();await db.exec('create or replace function private.is_admin() returns boolean language sql as $$select true$$');
   try{await asActor(db,null,()=>assert.rejects(message(id),/authentication required/i));}finally{await db.exec('create or replace function private.is_admin() returns boolean language sql as $$select false$$');}
   assert.equal(Number((await db.query('select count(*) n from fitting_request_messages')).rows[0].n),0);
  });
  for(const status of ['requested','completed'])await t.test('fitting messages preserve accepted-only '+status+' restriction',async()=>{
   const id=await messageFixture();await db.query('update fitting_requests set status=$1 where id=$2',[status,id]);await assert.rejects(message(id),/messages are available after/i);
   assert.equal(Number((await db.query('select count(*) n from fitting_request_messages')).rows[0].n),0);
  });
  if(!baseline&&!messageBaseline)await t.test('message preserves hosted grants and unbound service denial',async()=>{
   for(const role of ['authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.send_fitting_request_message(uuid,text)','execute') allowed",[role])).rows[0].allowed,true);
   assert.equal((await db.query("select has_function_privilege('anon','public.send_fitting_request_message(uuid,text)','execute') allowed")).rows[0].allowed,false);
   const id=await messageFixture();await asActor(db,null,async()=>{await db.exec('set role service_role');try{await assert.rejects(message(id),/authentication required/i);}finally{await db.exec('reset role');}});
   await db.exec('set role anon');try{await assert.rejects(message(id),/permission denied/i);}finally{await db.exec('reset role');}
  });
  await t.test('reciprocal fitting fixture seeds both real buyer identities',async()=>{
   await reset(db);await db.query('insert into auth.users values($1)',[garageOwner]);await db.query('insert into profiles values($1)',[garageOwner]);
   assert.ok((await fitting(db)).rows[0].id);await asActor(db,garageOwner,async()=>assert.ok((await fitting(db,buyerGarage)).rows[0].id));
   assert.equal((await db.query('select count(*)::int n from fitting_requests')).rows[0].n,2);
  });
  if(postgresMode){
   async function waiting(pid){
    const until=Date.now()+5000;
    while(Date.now()<until){
     const row=(await db.query('select wait_event_type,wait_event from pg_stat_activity where pid=$1',[pid])).rows[0];
     if(row?.wait_event_type==='Lock'&&row?.wait_event==='advisory')return;
     await new Promise(resolve=>setTimeout(resolve,20));
    }
    throw new Error('Competing operation did not wait on the shared account advisory lock.');
   }
   const a=new db.Client({connectionString:db.url,statement_timeout:15000});
   const b=new db.Client({connectionString:db.url,statement_timeout:15000});
   try{
    await Promise.all([a.connect(),b.connect()]);
    const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
    await t.test('PG17 checkout first forces claim to wait, then block',async()=>{
     await reset(db);await a.query('begin');await checkout(a);
     const pending=claim(b).then(result=>({result}),error=>({error}));
     await waiting(pid);await a.query('commit');
     const settled=await pending;if(settled.error)throw settled.error;
     assert.equal(settled.result.rows[0].claimed,false);
     assert.equal(settled.result.rows[0].blocker_code,'buyer_commerce_active');
     assert.equal((await db.query('select buyer_id from orders')).rows[0].buyer_id,uid);
    });
    await t.test('PG17 claim first forces checkout to wait, then reject',async()=>{
     await reset(db);await a.query('begin');assert.equal((await claim(a)).rows[0].claimed,true);
     const pending=checkout(b).then(result=>({result}),error=>({error}));
     await waiting(pid);await a.query('commit');
     const settled=await pending;assert.match(settled.error?.message??'',/deletion.*in progress/i);
     assert.deepEqual(await snapshot(db),{orders:0,stock:1});
    });
    for(const participant of ['buyer','garage']){
     await t.test('PG17 fitting first forces '+participant+' claim to wait, then block',async()=>{
      await reset(db);if(participant==='garage')await garageDeletion(db);const target=participant==='garage'?garageRequest:request;
      await a.query('begin');await fitting(a);
      const pending=claim(b,target).then(result=>({result}),error=>({error}));
      await waiting(pid);await a.query('commit');const settled=await pending;if(settled.error)throw settled.error;
      assert.equal(settled.result.rows[0].claimed,false);assert.equal(settled.result.rows[0].blocker_code,'fitting_request_active');
     });
     await t.test('PG17 '+participant+' claim first forces fitting to wait, then reject',async()=>{
      await reset(db);if(participant==='garage')await garageDeletion(db);const target=participant==='garage'?garageRequest:request;
      await a.query('begin');assert.equal((await claim(a,target)).rows[0].claimed,true);
      const pending=fitting(b).then(result=>({result}),error=>({error}));
      await waiting(pid);await a.query('commit');const settled=await pending;assert.match(settled.error?.message??'',/deletion.*in progress|garage partner.*not available/i);
      assert.equal((await db.query('select count(*)::int n from fitting_requests')).rows[0].n,0);
     });
    }
    await t.test('PG17 reciprocal fitting accounts acquire lower account first without inversion',async()=>{
     await reset(db);
     await db.query('insert into auth.users values($1)',[garageOwner]);
     await db.query('insert into profiles values($1)',[garageOwner]);
     await db.exec("create or replace function auth.uid() returns uuid language sql as $$select coalesce(nullif(current_setting('secondpart.test_actor',true),''),'"+uid+"')::uuid$$");
     await a.query("select set_config('secondpart.test_actor',$1,false)",[uid]);
     await b.query("select set_config('secondpart.test_actor',$1,false)",[garageOwner]);
     await a.query('begin');
     // Hold the lower identity first. A buyer-first implementation on the
     // reciprocal call would take the higher lock and deadlock the next call.
     await a.query("select pg_advisory_xact_lock(hashtextextended('secondpart-account-commerce:'||$1::text,0))",[uid]);
     const reciprocal=fitting(b,buyerGarage).then(result=>({result}),error=>({error}));
     await waiting(pid);assert.ok((await fitting(a)).rows[0].id);await a.query('commit');
     const settled=await reciprocal;if(settled.error)throw settled.error;assert.ok(settled.result.rows[0].id);
     assert.equal((await db.query('select count(*)::int n from fitting_requests')).rows[0].n,2);
    });
    console.log('PostgreSQL '+(await db.query('show server_version')).rows[0].server_version);
   }finally{await a.query('rollback').catch(()=>{});await Promise.all([a.end().catch(()=>{}),b.end().catch(()=>{})]);}
  }
 }finally{await db.close();}
});
