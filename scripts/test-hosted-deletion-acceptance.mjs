import assert from 'node:assert/strict';
import test from 'node:test';
import {buildHostedAcceptance} from './build-hosted-deletion-acceptance.mjs';

export const input={buyer:'4514c0f5-3d57-419f-9c12-852273739b27',garageOwner:'c3004680-7cd8-418d-a79b-0c25faa3da6e',stranger:'7c7cad1e-9ed7-4afc-b2f4-00548554cf12',runId:'rc26-hosted-20261008-autonomous'};
test('each hosted behavior has an independent fresh transaction artifact',()=>{
 const cases=buildHostedAcceptance(input);
 assert.ok(Array.isArray(cases),'cross-case reset SQL must become separate scenario artifacts');
 const ids=cases.flatMap(item=>Object.values(item.fixtureIds));
 assert.equal(new Set(ids).size,ids.length,'fixtures must never be reused between scenarios');
 assert.ok(cases.some(item=>item.name==='checkout-processing'));
 assert.ok(cases.every(item=>item.postRollbackQuery&&item.query));
});

import fs from 'node:fs';
import crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

async function localDatabase(){
 const db=new PGlite();
 await db.exec(`
 create schema auth;create schema private;
 create role anon;create role authenticated;create role service_role bypassrls;
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 create type public.listing_status as enum('draft','active','reserved','archived');
 create table auth.users(id uuid primary key,raw_app_meta_data jsonb);
 create table public.profiles(id uuid primary key references auth.users(id),role text default 'buyer',updated_at timestamptz default now());
 create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
 create function private.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at:=now();return new;end$$;
 create trigger touch before update on profiles for each row execute function private.touch_updated_at();
 create function private.protect_profile_role() returns trigger language plpgsql security definer set search_path='' as $$begin if new.role is distinct from old.role and auth.jwt()->>'role'<>'service_role' and not private.is_admin() then raise exception 'Only administrators can change account roles';end if;return new;end$$;
 create trigger protect_role before update on profiles for each row execute function private.protect_profile_role();
 create table sellers(id uuid primary key,owner_id uuid,business_name text,slug text,location text,seller_type text,account_deleted_at timestamptz);
 create table seller_payment_accounts(seller_id uuid primary key,onboarding_status text,transfers_enabled boolean);
 create table categories(id uuid primary key,parent_id uuid,is_selectable boolean);
 create table parts(id uuid primary key,seller_id uuid,category_id uuid,title text,slug text,description text,condition text,price_pence integer,stock integer,status listing_status,collection_available boolean,shipping_pence integer default 0);
 create table garage_partners(id uuid primary key,owner_id uuid,business_name text,slug text,location text,postcode text,description text,status text,customer_supplied_parts boolean default true,recycled_parts boolean default true,verified_at timestamptz);
 create table account_deletion_requests(id uuid primary key,profile_id uuid,target_profile_id uuid,status text,attempt_count integer,reason text,blocker_code text,processing_started_at timestamptz,last_error text,updated_at timestamptz,cleanup_seller_ids uuid[],cleanup_garage_partner_ids uuid[]);
 create table commerce_settings(singleton boolean,platform_fee_bps integer,checkout_reservation_minutes integer);
 create table orders(id uuid primary key default gen_random_uuid(),buyer_id uuid,status text,total_pence integer,currency text,subtotal_pence integer,shipping_pence integer,platform_fee_pence integer,payment_status text,payment_provider text,checkout_expires_at timestamptz);
 create table order_items(id uuid primary key default gen_random_uuid(),order_id uuid,part_id uuid,seller_id uuid,quantity integer,unit_price_pence integer,fulfilment_status text,delivery_method text,shipping_pence integer,platform_fee_pence integer,seller_net_pence integer,payout_status text);
 create table order_events(order_id uuid,order_item_id uuid,actor_profile_id uuid,event_type text,to_status text,metadata jsonb);
 create table vehicle_catalogue_years(variant_id uuid,year_first_used smallint);
 create table vehicle_catalogue_engines(variant_id uuid,fuel_type text,engine_size_simple integer);
 create table fitting_requests(id uuid primary key default gen_random_uuid(),buyer_id uuid,part_id uuid,garage_partner_id uuid,vehicle_variant_id uuid,vehicle_year smallint,status text default 'requested',vehicle_registration text,buyer_notes text,vehicle_fuel text,vehicle_engine_size integer,quote_pence integer,quote_note text,quoted_at timestamptz,completed_at timestamptz,buyer_responded_at timestamptz);
 create table fitting_request_messages(id uuid primary key default gen_random_uuid(),fitting_request_id uuid,sender_profile_id uuid,body text);
 create table notifications(id uuid primary key default gen_random_uuid(),profile_id uuid,type text,title text,body text,href text,dedupe_key text unique);
 create table mobile_push_devices(id uuid,profile_id uuid,enabled boolean);
 create table mobile_push_outbox(notification_id uuid,profile_id uuid,device_id uuid);
 create table part_requests(id uuid,category_id uuid,status text);
 create table private.part_request_refresh_queue(request_id uuid,enqueued_at timestamptz);
 create table private.saved_search_match_queue(part_id uuid);
 create table private.part_image_cleanup(part_id uuid);
 create function private.enqueue_mobile_push() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.mobile_push_outbox select new.id,new.profile_id,d.id from public.mobile_push_devices d where d.profile_id=new.profile_id and d.enabled;return new;end$$;
 create trigger notification_outbox after insert on notifications for each row execute function private.enqueue_mobile_push();
 create function seller_checkout_ready(p_seller_id uuid) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.sellers s join public.seller_payment_accounts a on a.seller_id=s.id where s.id=p_seller_id and s.account_deleted_at is null and a.onboarding_status='complete' and a.transfers_enabled)$$;
 create function private.account_deletion_blocker(uuid) returns text language sql as $$select null::text$$;
 grant usage on schema public,auth,private to anon,authenticated,service_role;
 grant select on all tables in schema public to authenticated;
 grant all on all tables in schema public to service_role;
 insert into categories values('10000000-0000-4000-8000-000000000001',null,true);
 insert into vehicle_catalogue_years values('533a5423-0638-44a2-aee1-6198818e91aa',2019);
 insert into commerce_settings values(true,0,30);
 `);
 for(const id of [input.buyer,input.garageOwner,input.stranger]){
  await db.query('insert into auth.users values($1,$2)',[id,{qa_run_id:input.runId,qa_evidence_class:'synthetic-not-mailbox'}]);await db.query('insert into profiles(id) values($1)',[id]);
 }
 const snapshot=JSON.parse(fs.readFileSync(new URL('../docs/test-runs/2026-10-08-deployed-deletion-functions.json',import.meta.url),'utf8'));
 assert.equal(snapshot.project_id,'etkupijfdznljimrfyct');assert.equal(snapshot.functions.length,5);
 for(const fn of snapshot.functions){
  assert.equal(crypto.createHash('md5').update(fn.definition).digest('hex'),fn.definition_md5,'snapshot must match recorded deployed body');
  await db.exec(fn.definition);
  await db.exec('revoke all on function public.'+fn.signature+' from public,anon,authenticated,service_role');
  const roles=fn.acl.includes('authenticated=X')?'authenticated,service_role':'service_role';
  await db.exec('grant execute on function public.'+fn.signature+' to '+roles);
 }
 return db;
}
async function runLocal(db,scenario){
 try{await db.exec(scenario.query);}catch(error){await db.exec('ROLLBACK;');throw error;}
 return (await db.exec(scenario.postRollbackQuery)).at(-1).rows[0].result;
}
test('exact deployed functions execute every independent scenario and leave no fixture or role state',async t=>{
 const db=await localDatabase();
 try{
  for(const scenario of buildHostedAcceptance(input))await t.test(scenario.name,async()=>{
   const before=(await db.query(scenario.contextQuery)).rows[0].result;
   const result=await runLocal(db,scenario);
   assert.ok(Object.values(result.fixture_counts).every(count=>Number(count)===0),'all fixture and delegated rows must disappear');
   assert.deepEqual(result.context,before.context,'transaction-local role/claims must disappear');
   assert.deepEqual(result.profile_roles,['buyer','buyer','buyer']);
   assert.equal(result.profile_state_hash,before.profile_state_hash,'profile roles and updated_at must be restored');
   assert.equal(result.refresh_queue_hash,before.refresh_queue_hash,'request queue must be restored');
  });
 }finally{await db.close();}
});
test('wrong role is rejected before expected-error handling and caller rolls back the same connection',async()=>{
 const db=await localDatabase();
 try{
  const scenario=buildHostedAcceptance(input).find(item=>item.name==='fitting-buyer-processing');
  const before=(await db.query(scenario.contextQuery)).rows[0].result;
  const invalid={...scenario,query:scenario.query.replace('set local role authenticated;','set local role postgres;')};
  await assert.rejects(runLocal(db,invalid),/wrong execution role\/actor/i);
  const after=(await db.exec(scenario.postRollbackQuery)).at(-1).rows[0].result;
  assert.ok(Object.values(after.fixture_counts).every(count=>Number(count)===0));assert.deepEqual(after.context,before.context);assert.equal(after.profile_state_hash,before.profile_state_hash);
 }finally{await db.close();}
});
