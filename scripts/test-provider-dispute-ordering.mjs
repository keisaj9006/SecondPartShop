import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const migration=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const candidate='20260913102500_provider_dispute_event_ordering.sql';
const baseline=process.argv.includes('--baseline');
const candidateUrl=new URL('../supabase/migrations/'+candidate,import.meta.url);
const id=n=>'50000000-0000-4000-8000-'+String(n).padStart(12,'0');
const buyer=id(1);
const sellerOwner=id(2);
const seller=id(3);
const part=id(4);

async function asService(db,sql,params=[]){
 await db.exec('set role service_role');
 try{return await db.query(sql,params);}finally{await db.exec('reset role');}
}

async function openDispute(db,{event,dispute,charge,status='needs_response',reason='fraudulent'}){
 const result=await asService(db,'select public.open_provider_payment_dispute($1,$2,$3,$4,$5) result',[event,dispute,charge,status,reason]);
 return result.rows[0].result;
}

async function closeDispute(db,{event,dispute,status='won',reversal=null}){
 const result=await asService(db,'select public.close_provider_payment_dispute($1,$2,$3,$4) result',[event,dispute,status,reversal]);
 return result.rows[0].result;
}

async function count(db,table,where='',params=[]){
 return Number((await db.query(`select count(*) count from public.${table}${where?' where '+where:''}`,params)).rows[0].count);
}

async function seedOrder(db,n,{charge=`ch_${n}`,fulfilment='delivered',payout='scheduled'}={}){
 const orderId=id(100+n);
 const itemId=id(200+n);
 await db.query('insert into public.orders(id,buyer_id,payment_status,status,provider_charge_id) values($1,$2,$3,$4,$5)',[orderId,buyer,'paid','processing',charge]);
 await db.query(`insert into public.order_items(
  id,order_id,part_id,seller_id,fulfilment_status,payout_status,release_eligible_at
 ) values($1,$2,$3,$4,$5,$6,now()+interval '48 hours')`,[itemId,orderId,part,seller,fulfilment,payout]);
 return {orderId,itemId,charge};
}

async function buildDatabase(){
 const db=new PGlite();
 await db.exec(`
  create schema private;
  create role anon nologin nosuperuser nobypassrls;
  create role authenticated nologin nosuperuser nobypassrls;
  create role service_role nologin nosuperuser bypassrls;
  grant usage on schema public to anon,authenticated,service_role;

  create function private.recompute_order_status(uuid) returns void
  language plpgsql security definer set search_path='' as $$begin return; end$$;

  create table public.payment_events(
   provider text not null,provider_event_id text not null unique,event_type text not null,payload_ref jsonb
  );
  create table public.orders(
   id uuid primary key,buyer_id uuid,payment_status text not null,status text not null,provider_charge_id text unique
  );
  create table public.sellers(id uuid primary key,owner_id uuid);
  create table public.parts(id uuid primary key,seller_id uuid not null,title text not null);
  create table public.order_items(
   id uuid primary key,order_id uuid not null,part_id uuid not null,seller_id uuid not null,
   fulfilment_status text not null,payout_status text not null,funds_released_at timestamptz,
   release_eligible_at timestamptz,provider_transfer_id text,provider_transfer_reversal_id text,
   payout_rollback_required boolean not null default false,dispute_opened_at timestamptz
  );
  create table public.transaction_cases(
   id uuid primary key default gen_random_uuid(),order_item_id uuid not null,opened_by uuid not null,
   case_type text not null,reason text,details text,status text not null,previous_fulfilment_status text,
   resolution_notes text,resolution text,resolved_at timestamptz,created_at timestamptz not null default now(),
   provider_transfer_reversal_id text
  );
  create unique index transaction_cases_one_open_per_item on public.transaction_cases(order_item_id)
   where status in ('open','seller_response','under_review','return_authorized','return_shipped','returned');
  create table public.order_events(
   order_id uuid not null,order_item_id uuid,event_type text not null,from_status text,to_status text,
   metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
  );
  create table public.notifications(
   profile_id uuid,type text,title text,body text,href text,dedupe_key text unique
  );
  create table public.profiles(id uuid primary key,role text);

  insert into public.sellers values('${seller}','${sellerOwner}');
  insert into public.parts values('${part}','${seller}','Used ABS pump');
 `);
 await db.exec(migration('20260906183500_provider_payment_disputes.sql'));
 await db.exec(migration('20260907162000_reverse_released_payout_on_lost_provider_dispute.sql'));
 if(!baseline&&fs.existsSync(candidateUrl))await db.exec(fs.readFileSync(candidateUrl,'utf8'));
 return db;
}

test(`provider dispute ordering uses real ${baseline?'pre-fix':'candidate'} SQL on a reduced schema`,async t=>{
 const db=await buildDatabase();
 try{
  t.diagnostic('PGlite is a reduced PostgreSQL 18 schema; hosted PostgreSQL 17 and Stripe webhook delivery remain separate RC evidence.');

  await t.test('create-before-paid remains retryable and does not consume its provider event',async()=>{
   const event='evt_open_before_paid';
   const dispute='dp_open_before_paid';
   const charge='ch_open_before_paid';
   await assert.rejects(openDispute(db,{event,dispute,charge}),/link|order|payment/i);
   assert.equal(await count(db,'payment_events','provider_event_id=$1',[event]),0);

   await seedOrder(db,1,{charge});
   const caseId=await openDispute(db,{event,dispute,charge});
   assert.ok(caseId);
   assert.equal(await count(db,'payment_events','provider_event_id=$1',[event]),1);
   assert.equal(await count(db,'order_events','event_type=$1 and metadata->>\'provider_dispute_id\'=$2',['provider_dispute_opened',dispute]),1);
  });

  await t.test('close-before-create remains retryable and later applies the provider outcome',async()=>{
   const event='evt_close_before_create';
   const dispute='dp_close_before_create';
   await assert.rejects(closeDispute(db,{event,dispute,status:'won'}),/link|case|dispute/i);
   assert.equal(await count(db,'payment_events','provider_event_id=$1',[event]),0);

   const seeded=await seedOrder(db,2,{charge:'ch_close_before_create'});
   const caseId=await openDispute(db,{event:'evt_open_for_close',dispute,charge:seeded.charge});
   assert.ok(caseId);
   assert.equal(await closeDispute(db,{event,dispute,status:'won'}),true);
   const row=(await db.query('select status,provider_dispute_status from public.transaction_cases where id=$1',[caseId])).rows[0];
   assert.equal(row.status,'resolved');
   assert.equal(row.provider_dispute_status,'won');
   assert.equal(await count(db,'payment_events','provider_event_id=$1',[event]),1);
  });

  await t.test('duplicate open and close deliveries are acknowledged without duplicate semantic events',async()=>{
   const seeded=await seedOrder(db,3,{charge:'ch_duplicate'});
   const openEvent='evt_open_duplicate';
   const closeEvent='evt_close_duplicate';
   const dispute='dp_duplicate';
   const first=await openDispute(db,{event:openEvent,dispute,charge:seeded.charge});
   const second=await openDispute(db,{event:openEvent,dispute,charge:seeded.charge});
   assert.equal(second,first);
   assert.equal(await count(db,'payment_events','provider_event_id=$1',[openEvent]),1);
   assert.equal(await count(db,'order_events','event_type=$1 and metadata->>\'provider_dispute_id\'=$2',['provider_dispute_opened',dispute]),1);

   assert.equal(await closeDispute(db,{event:closeEvent,dispute,status:'won'}),true);
   assert.equal(await closeDispute(db,{event:closeEvent,dispute,status:'won'}),true);
   assert.equal(await count(db,'payment_events','provider_event_id=$1',[closeEvent]),1);
   assert.equal(await count(db,'order_events','event_type=$1 and metadata->>\'provider_dispute_id\'=$2',['provider_dispute_closed',dispute]),1);
  });

  await t.test('late provider dispute reuses the one active return case instead of violating the single-case invariant',async()=>{
   const seeded=await seedOrder(db,4,{charge:'ch_late_return',fulfilment:'return_approved',payout:'blocked'});
   const existing=id(904);
   await db.query(`insert into public.transaction_cases(
    id,order_item_id,opened_by,case_type,reason,details,status,previous_fulfilment_status
   ) values($1,$2,$3,'return','Not as described','Return already in transit','return_shipped','delivered')`,[existing,seeded.itemId,buyer]);

   const dispute='dp_late_return';
   const caseId=await openDispute(db,{event:'evt_late_return',dispute,charge:seeded.charge});
   assert.equal(caseId,existing);
   assert.equal(await count(db,'transaction_cases','order_item_id=$1 and status in (\'open\',\'seller_response\',\'under_review\',\'return_authorized\',\'return_shipped\',\'returned\')',[seeded.itemId]),1);
   const row=(await db.query('select status,provider_dispute_id from public.transaction_cases where id=$1',[existing])).rows[0];
   assert.equal(row.status,'under_review');
   assert.equal(row.provider_dispute_id,dispute);
  });
 }finally{await db.close();}
});
