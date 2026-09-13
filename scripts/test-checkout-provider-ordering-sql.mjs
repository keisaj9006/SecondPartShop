import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const migration=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

async function buildDb(){
 const db=new PGlite();
 await db.exec(`
  create role anon;create role authenticated;create role service_role;
  create type listing_status as enum ('active','reserved','draft','sold');
  create table sellers(id uuid primary key,owner_id uuid,business_name text);
  create table orders(
   id uuid primary key,buyer_id uuid,payment_status text,status text,
   provider_checkout_session_id text,provider_payment_intent_id text,provider_charge_id text,
   shipping_name text,shipping_address jsonb,paid_at timestamptz,cancelled_at timestamptz
  );
  create table parts(id uuid primary key,seller_id uuid,stock integer,status listing_status,title text);
  create table order_items(
   id uuid primary key,order_id uuid,part_id uuid,seller_id uuid,quantity integer,
   fulfilment_status text,cancelled_at timestamptz
  );
  create table order_events(
   order_id uuid,order_item_id uuid,actor_profile_id uuid,event_type text,
   from_status text,to_status text,metadata jsonb default '{}'::jsonb
  );
  create table payment_events(
   provider text,provider_event_id text unique,event_type text,order_id uuid,
   payload_ref jsonb default '{}'::jsonb
  );
  create table notifications(
   profile_id uuid,type text,title text,body text,href text,dedupe_key text unique
  );
  create function seller_checkout_ready(uuid) returns boolean language sql as 'select true';
 `);
 await db.exec(migration('20260911084500_checkout_terminal_buyer_notification.sql'));
 await db.exec(migration('20260912215018_checkout_cancellation_session_guard.sql'));
 await db.exec(migration('20260913104500_checkout_terminal_event_session_claim.sql'));
 await db.exec(migration('20260911093000_confirm_checkout_paid_provider_guard.sql'));
 await db.query('insert into sellers values($1,$2,$3)',[id(30),id(31),'RC Seller']);
 return db;
}

async function seed(db,{session=null,payment='unpaid'}={}){
 await db.exec('truncate orders,parts,order_items,order_events,payment_events,notifications');
 await db.query('insert into orders(id,buyer_id,payment_status,status,provider_checkout_session_id) values($1,$2,$3,$4,$5)',[id(1),id(2),payment,'pending_payment',session]);
 await db.query("insert into parts(id,seller_id,stock,status,title) values($1,$2,0,'reserved',$3)",[id(3),id(30),'Last-stock alternator']);
 await db.query("insert into order_items(id,order_id,part_id,seller_id,quantity,fulfilment_status) values($1,$2,$3,$4,1,'pending')",[id(4),id(1),id(3),id(30)]);
}

async function confirm(db,{event='evt_paid',session='cs_order',intent='pi_order',charge='ch_order'}={}){
 return (await db.query('select confirm_checkout_paid($1,$2,$3,$4,$5,null,null) ok',[id(1),event,session,intent,charge])).rows[0].ok;
}

async function terminal(db,{event='evt_expired',session='cs_order',type='checkout.session.expired'}={}){
 return (await db.query('select cancel_checkout_order_from_provider_event($1,$2,$3,$4) ok',[id(1),session,event,type])).rows[0].ok;
}

const count=async(db,table,where='true')=>Number((await db.query(`select count(*) n from ${table} where ${where}`)).rows[0].n);


test('paid webhook before local session attach remains retryable and succeeds exactly once after attach',async()=>{
 const db=await buildDb();
 try{
  await seed(db,{session:null});
  await assert.rejects(confirm(db,{event:'evt_paid_pre_attach',session:'cs_late'}),/Checkout Session does not match/i);
  assert.equal(await count(db,'payment_events'),0,'failed pre-attach confirmation must not consume the Stripe event');
  assert.equal((await db.query('select payment_status from orders')).rows[0].payment_status,'unpaid');

  await db.query('update orders set provider_checkout_session_id=$1 where id=$2',['cs_late',id(1)]);
  assert.equal(await confirm(db,{event:'evt_paid_pre_attach',session:'cs_late'}),true);
  assert.equal((await db.query('select payment_status from orders')).rows[0].payment_status,'paid');
  assert.equal((await db.query('select status::text from parts')).rows[0].status,'sold');
  assert.equal(await count(db,'payment_events',"provider_event_id='evt_paid_pre_attach'"),1);
  assert.equal(await count(db,'order_events',"event_type='payment_confirmed'"),1);

  assert.equal(await confirm(db,{event:'evt_paid_pre_attach',session:'cs_late'}),false,'same provider event replay is acknowledged without another transition');
  assert.equal(await count(db,'payment_events',"provider_event_id='evt_paid_pre_attach'"),1);
  assert.equal(await count(db,'order_events',"event_type='payment_confirmed'"),1);
 }finally{await db.close();}
});


test('paid state wins against a delayed terminal Checkout event for the same session',async()=>{
 const db=await buildDb();
 try{
  await seed(db,{session:'cs_paid'});
  assert.equal(await confirm(db,{event:'evt_paid_first',session:'cs_paid'}),true);
  assert.equal(await terminal(db,{event:'evt_expired_late',session:'cs_paid'}),false);
  const order=(await db.query('select payment_status,provider_checkout_session_id from orders')).rows[0];
  assert.equal(order.payment_status,'paid');
  assert.equal(order.provider_checkout_session_id,'cs_paid');
  assert.equal((await db.query('select stock from parts')).rows[0].stock,0);
  assert.equal(await count(db,'payment_events',"provider_event_id='evt_expired_late'"),0,'stale terminal event must not be consumed as a cancellation');
 }finally{await db.close();}
});


test('terminal expiry first prevents a delayed paid webhook from resurrecting the cancelled order',async()=>{
 const db=await buildDb();
 try{
  await seed(db,{session:'cs_expired'});
  assert.equal(await terminal(db,{event:'evt_expired_first',session:'cs_expired'}),true);
  assert.equal((await db.query('select stock from parts')).rows[0].stock,1);
  assert.equal((await db.query('select payment_status from orders')).rows[0].payment_status,'cancelled');

  await assert.rejects(confirm(db,{event:'evt_paid_late',session:'cs_expired'}),/Cannot mark a cancelled order paid/i);
  assert.equal(await count(db,'payment_events',"provider_event_id='evt_paid_late'"),0,'rejected late paid event must remain unconsumed');
  assert.equal((await db.query('select payment_status from orders')).rows[0].payment_status,'cancelled');
  assert.equal((await db.query('select stock from parts')).rows[0].stock,1);
 }finally{await db.close();}
});
