import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const migration=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const candidate='20260913104500_checkout_terminal_event_session_claim.sql';
const candidateUrl=new URL('../supabase/migrations/'+candidate,import.meta.url);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('actual cancellation SQL retains provider/session, paid, stock and privilege guards on reduced schema',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon;create role authenticated;create role service_role;
   create type listing_status as enum ('active','reserved','draft');
   create table orders(id uuid primary key,buyer_id uuid,payment_status text,status text,provider_checkout_session_id text,cancelled_at timestamptz);
   create table parts(id uuid primary key,seller_id uuid,stock integer,status listing_status);
   create table order_items(id uuid primary key,order_id uuid,part_id uuid,quantity integer,fulfilment_status text,cancelled_at timestamptz);
   create table order_events(order_id uuid,event_type text,from_status text,to_status text,metadata jsonb);
   create table payment_events(provider text,provider_event_id text unique,event_type text,order_id uuid);
   create table notifications(profile_id uuid,type text,title text,body text,href text,dedupe_key text unique);
   create function seller_checkout_ready(uuid) returns boolean language sql as 'select true';
  `);
  await db.exec(migration('20260911084500_checkout_terminal_buyer_notification.sql'));
  await db.exec(migration('20260912215018_checkout_cancellation_session_guard.sql'));
  if(fs.existsSync(candidateUrl))await db.exec(fs.readFileSync(candidateUrl,'utf8'));
  const exists=(await db.query("select count(*)::int n from pg_proc where proname='cancel_checkout_order_if_session_matches'")).rows[0].n;
  assert.equal(exists,1,'session-specific guarded cancellation RPC must exist');
  const terminalExists=(await db.query("select count(*)::int n from pg_proc where proname='cancel_checkout_order_from_provider_event'")).rows[0].n;
  assert.equal(terminalExists,1,'terminal provider-event cancellation RPC must exist');
  const reset=async(session='cs_old',status='unpaid')=>{
   await db.exec('truncate orders,parts,order_items,order_events,payment_events,notifications');
   await db.query('insert into orders values($1,$2,$3,$3,$4,null)',[id(1),id(2),status,session]);
   await db.query("insert into parts values($1,$2,0,'reserved');",[id(3),id(4)]);
   await db.query("insert into order_items values($1,$2,$3,1,'pending',null)",[id(5),id(1),id(3)]);
  };
  const cancel=async(session,buyer=id(2),event='buyer_cancelled_checkout')=>(await db.query('select cancel_checkout_order_if_session_matches($1,$2,$3,null,$4) cancelled',[id(1),session,buyer,event])).rows[0].cancelled;
  const providerCancel=async(session,eventId='evt_terminal',eventType='checkout.session.expired')=>(await db.query('select cancel_checkout_order_from_provider_event($1,$2,$3,$4) cancelled',[id(1),session,eventId,eventType])).rows[0].cancelled;
  const stock=async()=>(await db.query('select stock from parts')).rows[0].stock;
  for(const [label,stored,expected,buyer,status] of [
   ['different newer session','cs_new','cs_old',id(2),'unpaid'],
   ['session attached after null snapshot','cs_new',null,id(2),'unpaid'],
   ['wrong buyer','cs_old','cs_old',id(9),'unpaid'],
   ['concurrent paid confirmation','cs_old','cs_old',id(2),'paid'],
   ['concurrent refund','cs_old','cs_old',id(2),'refunded'],
  ])await t.test(label+' cannot release stock',async()=>{await reset(stored,status);assert.equal(await cancel(expected,buyer),false);assert.equal(await stock(),0);assert.equal((await db.query('select count(*)::int n from order_events')).rows[0].n,0);});
  await t.test('confirmed expired session cancellation is idempotent',async()=>{await reset();assert.equal(await cancel('cs_old'),true);assert.equal(await cancel('cs_old'),true);assert.equal(await stock(),1);assert.equal((await db.query('select count(*)::int n from order_events')).rows[0].n,1);});
  await t.test('null-session setup rollback uses null-safe equality',async()=>{await reset(null);assert.equal(await cancel(null),true);assert.equal(await stock(),1);});
  await t.test('local timer cannot release provider-owned stock',async()=>{await reset();assert.equal(await cancel('cs_old',id(2),'checkout_reservation_expired'),false);assert.equal(await stock(),0);});
  await t.test('terminal webhook notification remains atomic and deduplicated',async()=>{await reset();assert.equal(await cancel('cs_old',null,'checkout.session.expired'),true);assert.equal(await cancel('cs_old',null,'checkout.session.expired'),true);assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n,1);});
  await t.test('terminal provider event can claim a not-yet-attached session and release stock once',async()=>{
   await reset(null,'unpaid');
   assert.equal(await providerCancel('cs_late','evt_pre_attach_expired','checkout.session.expired'),true);
   assert.equal(await stock(),1);
   const order=(await db.query('select payment_status,provider_checkout_session_id from orders')).rows[0];
   assert.equal(order.payment_status,'cancelled');
   assert.equal(order.provider_checkout_session_id,'cs_late');
   assert.equal((await db.query("select count(*)::int n from payment_events where provider_event_id='evt_pre_attach_expired'")).rows[0].n,1);
   assert.equal((await db.query('select count(*)::int n from order_events')).rows[0].n,1);
  });
  await t.test('stale terminal event cannot cancel a different attached session',async()=>{
   await reset('cs_new','unpaid');
   assert.equal(await providerCancel('cs_old','evt_stale_terminal'),false);
   assert.equal(await stock(),0);
   const order=(await db.query('select payment_status,provider_checkout_session_id from orders')).rows[0];
   assert.equal(order.payment_status,'unpaid');
   assert.equal(order.provider_checkout_session_id,'cs_new');
   assert.equal((await db.query('select count(*)::int n from payment_events')).rows[0].n,0);
  });
  await t.test('terminal event cannot cancel a paid order even when session correlation is missing',async()=>{
   await reset(null,'paid');
   assert.equal(await providerCancel('cs_paid','evt_paid_terminal'),false);
   assert.equal(await stock(),0);
   assert.equal((await db.query('select provider_checkout_session_id from orders')).rows[0].provider_checkout_session_id,null);
  });
  await t.test('terminal provider-event RPC rejects non-terminal event types',async()=>{
   await reset(null,'unpaid');
   await assert.rejects(providerCancel('cs_bad','evt_bad','checkout.session.completed'),/terminal/i);
   assert.equal(await stock(),0);
  });
  await t.test('all cancellation RPCs remain inaccessible to public client roles',async()=>{
   for(const role of ['anon','authenticated','service_role'])for(const name of [
    'cancel_checkout_order(uuid,text,text)',
    'cancel_checkout_order_if_session_matches(uuid,text,uuid,text,text)',
    'cancel_checkout_order_from_provider_event(uuid,text,text,text)'
   ]){
    const result=await db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,name]);assert.equal(result.rows[0].allowed,role==='service_role');
   }
  });
  const webhook=fs.readFileSync(new URL('../src/app/api/stripe/webhook/route.ts',import.meta.url),'utf8');
  assert.match(webhook,/admin\.rpc\("cancel_checkout_order_from_provider_event"/,'terminal Stripe webhooks must use the provider-event RPC');
 }finally{await db.close();}
});