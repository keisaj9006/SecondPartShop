import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const migration=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const baseline=process.argv.includes('--baseline');
const id=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0');
const buyer=id(1);
const sellerOwner=id(2);
const seller=id(3);
const part=id(4);

async function asBuyer(db,actor,sql,params=[]){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor??'']);
 await db.exec('set role authenticated');
 try{return await db.query(sql,params);}finally{await db.exec('reset role');}
}

async function receipt(db,itemId,acceptNow=false,actor=buyer){
 return (await asBuyer(db,actor,'select public.buyer_mark_order_item_received($1,$2) result',[itemId,acceptNow])).rows[0].result;
}

async function item(db,itemId){
 return (await db.query('select * from public.order_items where id=$1',[itemId])).rows[0];
}

async function eventCount(db,itemId,eventType){
 return Number((await db.query('select count(*) count from public.order_events where order_item_id=$1 and event_type=$2',[itemId,eventType])).rows[0].count);
}

async function notificationCount(db,itemId,state){
 return Number((await db.query('select count(*) count from public.notifications where dedupe_key=$1',['buyer-received:'+itemId+':'+state])).rows[0].count);
}

async function buildDatabase(){
 const db=new PGlite();
 await db.exec(`
  create schema auth;
  create schema private;
  create role anon nologin nosuperuser nobypassrls;
  create role authenticated nologin nosuperuser nobypassrls;
  create role service_role nologin nosuperuser bypassrls;
  grant usage on schema public,auth to anon,authenticated,service_role;
  create function auth.uid() returns uuid language sql stable
   as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function private.is_admin() returns boolean language sql stable as $$select false$$;

  create table public.orders(
   id uuid primary key,buyer_id uuid,payment_status text not null,status text not null
  );
  create table public.sellers(id uuid primary key,owner_id uuid);
  create table public.parts(id uuid primary key,seller_id uuid not null,title text not null);
  create table public.order_items(
   id uuid primary key,order_id uuid not null,part_id uuid not null,seller_id uuid not null,
   delivery_method text not null default 'shipping',fulfilment_status text not null,
   payout_status text not null,buyer_received_at timestamptz,delivered_at timestamptz,
   accepted_at timestamptz,release_eligible_at timestamptz,funds_released_at timestamptz
  );
  create table public.commerce_settings(singleton boolean primary key,auto_release_hours integer not null);
  create table public.order_events(
   order_id uuid not null,order_item_id uuid,actor_profile_id uuid,event_type text not null,
   from_status text,to_status text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
  );
  create table public.notifications(
   profile_id uuid,type text,title text,body text,href text,dedupe_key text unique
  );
  create table public.transaction_cases(order_item_id uuid not null,status text not null);
  insert into public.commerce_settings values(true,48);
 `);
 await db.exec(migration('20260906173000_fulfilment_and_payout_lifecycle.sql'));
 if(!baseline)await db.exec(migration('20260912220057_buyer_receipt_idempotency.sql'));
 await db.query('insert into public.sellers values($1,$2)',[seller,sellerOwner]);
 await db.query('insert into public.parts values($1,$2,$3)',[part,seller,'Used starter motor']);
 return db;
}

async function seedItem(db,n,{owner=buyer,payment='paid',fulfilment='dispatched',payout='not_ready',received=null,delivered=null,accepted=null,eligible=null,released=null}={}){
 const orderId=id(100+n);
 const itemId=id(200+n);
 await db.query('insert into public.orders values($1,$2,$3,$4)',[orderId,owner,payment,'processing']);
 await db.query(`insert into public.order_items(
  id,order_id,part_id,seller_id,fulfilment_status,payout_status,buyer_received_at,delivered_at,accepted_at,release_eligible_at,funds_released_at
 ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[itemId,orderId,part,seller,fulfilment,payout,received,delivered,accepted,eligible,released]);
 return itemId;
}

test(`buyer receipt uses real ${baseline?'pre-fix':'candidate'} SQL on a reduced schema`,async t=>{
 const db=await buildDatabase();
 try{
  t.diagnostic('PGlite is a reduced PostgreSQL 18 schema; hosted PostgreSQL 17, RLS and provider payout execution remain separate gates.');

  const privileges=(await db.query(`select
   has_function_privilege('anon','public.buyer_mark_order_item_received(uuid,boolean)','execute') anon,
   has_function_privilege('authenticated','public.buyer_mark_order_item_received(uuid,boolean)','execute') authenticated,
   has_function_privilege('service_role','public.buyer_mark_order_item_received(uuid,boolean)','execute') service`)).rows[0];
  assert.deepEqual(privileges,{anon:false,authenticated:true,service:false});

  await t.test('the first Received starts exactly one configured 48-hour window',async()=>{
   const itemId=await seedItem(db,1);
   const before=Date.now();
   assert.equal(await receipt(db,itemId),true);
   const after=Date.now();
   const row=await item(db,itemId);
   const receivedAt=new Date(row.buyer_received_at).getTime();
   assert.equal(row.fulfilment_status,'delivered');
   assert.equal(row.payout_status,'scheduled');
   assert.equal(new Date(row.delivered_at).getTime(),receivedAt);
   assert.equal(new Date(row.release_eligible_at).getTime()-receivedAt,48*60*60*1000);
   assert.ok(receivedAt>=before&&receivedAt<=after);
   assert.equal(await eventCount(db,itemId,'buyer_received'),1);
   assert.equal(await notificationCount(db,itemId,'delivered'),1);
  });

  await t.test('later Received retries, including explicit NULL, preserve the first state and semantic event',async()=>{
   const itemId=id(201);
   const firstReceipt='2026-08-01T12:00:00.000Z';
   const firstDeadline='2026-08-03T12:00:00.000Z';
   await db.query('update public.order_items set buyer_received_at=$2,delivered_at=$2,release_eligible_at=$3 where id=$1',[itemId,firstReceipt,firstDeadline]);
   assert.equal(await receipt(db,itemId),true);
   const row=await item(db,itemId);
   assert.equal(new Date(row.buyer_received_at).toISOString(),firstReceipt);
   assert.equal(new Date(row.delivered_at).toISOString(),firstReceipt);
   assert.equal(new Date(row.release_eligible_at).toISOString(),firstDeadline);
   assert.equal(row.payout_status,'scheduled');
   assert.equal(await eventCount(db,itemId,'buyer_received'),1);
   assert.equal(await notificationCount(db,itemId,'delivered'),1);

   assert.equal(await receipt(db,itemId,null),true);
   const nullRetried=await item(db,itemId);
   assert.equal(new Date(nullRetried.buyer_received_at).toISOString(),firstReceipt);
   assert.equal(new Date(nullRetried.delivered_at).toISOString(),firstReceipt);
   assert.equal(new Date(nullRetried.release_eligible_at).toISOString(),firstDeadline);
   assert.equal(nullRetried.payout_status,'scheduled');
   assert.equal(await eventCount(db,itemId,'buyer_received'),1);
   assert.equal(await notificationCount(db,itemId,'delivered'),1);
  });

  await t.test('later explicit Accept is immediate and itself idempotent',async()=>{
   const itemId=id(201);
   const receivedAt=(await item(db,itemId)).buyer_received_at;
   const before=Date.now();
   assert.equal(await receipt(db,itemId,true),true);
   const after=Date.now();
   const accepted=await item(db,itemId);
   assert.equal(accepted.fulfilment_status,'accepted');
   assert.equal(accepted.payout_status,'scheduled');
   assert.equal(new Date(accepted.buyer_received_at).getTime(),new Date(receivedAt).getTime());
   assert.ok(new Date(accepted.release_eligible_at).getTime()>=before&&new Date(accepted.release_eligible_at).getTime()<=after);
   assert.equal(await eventCount(db,itemId,'buyer_accepted'),1);

   const acceptedAt=accepted.accepted_at;
   const deadline=accepted.release_eligible_at;
   assert.equal(await receipt(db,itemId,true),true);
   const retried=await item(db,itemId);
   assert.equal(new Date(retried.accepted_at).getTime(),new Date(acceptedAt).getTime());
   assert.equal(new Date(retried.release_eligible_at).getTime(),new Date(deadline).getTime());
   assert.equal(await eventCount(db,itemId,'buyer_accepted'),1);
  });

  await t.test('Received after Accept cannot downgrade accepted or released state',async()=>{
   const acceptedAt='2026-08-02T12:00:00.000Z';
   const itemId=await seedItem(db,2,{fulfilment:'accepted',payout:'released',received:'2026-08-01T12:00:00Z',delivered:'2026-08-01T12:00:00Z',accepted:acceptedAt,eligible:acceptedAt,released:acceptedAt});
   assert.equal(await receipt(db,itemId,false),true);
   const row=await item(db,itemId);
   assert.equal(row.fulfilment_status,'accepted');
   assert.equal(row.payout_status,'released');
   assert.equal(new Date(row.accepted_at).toISOString(),acceptedAt);
   assert.equal(await eventCount(db,itemId,'buyer_received'),0);
  });

  await t.test('receipt actions cannot downgrade an in-flight provider release claim',async()=>{
   const firstReceipt='2026-08-01T12:00:00.000Z';
   const firstDeadline='2026-08-03T12:00:00.000Z';
   const itemId=await seedItem(db,3,{fulfilment:'delivered',payout:'releasing',received:firstReceipt,delivered:firstReceipt,eligible:firstDeadline});
   assert.equal(await receipt(db,itemId,false),true);
   let row=await item(db,itemId);
   assert.equal(row.payout_status,'releasing');
   assert.equal(new Date(row.release_eligible_at).toISOString(),firstDeadline);
   assert.equal(await receipt(db,itemId,true),true);
   row=await item(db,itemId);
   assert.equal(row.fulfilment_status,'accepted');
   assert.equal(row.payout_status,'releasing');
   assert.equal(new Date(row.release_eligible_at).toISOString(),firstDeadline);
  });

  await t.test('every active transaction-case stage blocks explicit acceptance and payout rescheduling',async()=>{
   const firstReceipt='2026-08-01T12:00:00.000Z';
   const firstDeadline='2026-08-03T12:00:00.000Z';
   const statuses=['open','seller_response','under_review','return_authorized','return_shipped','returned'];
   for(const [index,status] of statuses.entries()){
    const itemId=await seedItem(db,40+index,{fulfilment:'delivered',payout:'blocked',received:firstReceipt,delivered:firstReceipt,eligible:firstDeadline});
    await db.query('insert into public.transaction_cases values($1,$2)',[itemId,status]);
    await assert.rejects(receipt(db,itemId,true),/active transaction case/i);
    const row=await item(db,itemId);
    assert.equal(row.fulfilment_status,'delivered');
    assert.equal(row.payout_status,'blocked');
    assert.equal(new Date(row.release_eligible_at).toISOString(),firstDeadline);
    assert.equal(await eventCount(db,itemId,'buyer_accepted'),0);
   }
  });

  await t.test('blocked and reversed payout states cannot be reopened by explicit acceptance',async()=>{
   const firstReceipt='2026-08-01T12:00:00.000Z';
   const firstDeadline='2026-08-03T12:00:00.000Z';
   for(const [index,payout] of ['blocked','reversed'].entries()){
    const itemId=await seedItem(db,60+index,{fulfilment:'delivered',payout,received:firstReceipt,delivered:firstReceipt,eligible:firstDeadline});
    await assert.rejects(receipt(db,itemId,true),/payout cannot be/i);
    const row=await item(db,itemId);
    assert.equal(row.fulfilment_status,'delivered');
    assert.equal(row.payout_status,payout);
    assert.equal(new Date(row.release_eligible_at).toISOString(),firstDeadline);
    assert.equal(await eventCount(db,itemId,'buyer_accepted'),0);
   }
  });

  await t.test('authentication, ownership, paid-state and readiness guards stay fail-closed',async()=>{
   const owned=await seedItem(db,5);
   const unpaid=await seedItem(db,6,{payment:'unpaid'});
   const notReady=await seedItem(db,7,{fulfilment:'preparing'});
   const detached=await seedItem(db,8,{owner:null});
   await assert.rejects(receipt(db,owned,false,id(999)),/purchase not found/i);
   await assert.rejects(receipt(db,detached),/purchase not found/i);
   await assert.rejects(receipt(db,unpaid),/has not been paid/i);
   await assert.rejects(receipt(db,notReady),/not ready for receipt confirmation/i);
   for(const itemId of [owned,detached,unpaid,notReady]){
    const row=await item(db,itemId);
    assert.equal(row.buyer_received_at,null);
    assert.equal(await eventCount(db,itemId,'buyer_received'),0);
   }
  });

  await t.test('receipt updates leave unrelated orders and events unchanged',async()=>{
   const unrelated=await seedItem(db,80,{fulfilment:'delivered',payout:'scheduled',received:'2026-07-01T12:00:00Z',delivered:'2026-07-01T12:00:00Z',eligible:'2026-07-03T12:00:00Z'});
   await db.query("insert into public.order_events(order_id,order_item_id,event_type,from_status,to_status) select order_id,id,'seller_note','delivered','delivered' from public.order_items where id=$1",[unrelated]);
   const before=await item(db,unrelated);
   const eventsBefore=await eventCount(db,unrelated,'seller_note');
   const target=await seedItem(db,90);
   await receipt(db,target);
   assert.deepEqual(await item(db,unrelated),before);
   assert.equal(await eventCount(db,unrelated,'seller_note'),eventsBefore);
  });
 }finally{await db.close();}
});
