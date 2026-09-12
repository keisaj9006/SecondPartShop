import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const migration=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
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
  const exists=(await db.query("select count(*)::int n from pg_proc where proname='cancel_checkout_order_if_session_matches'")).rows[0].n;
  assert.equal(exists,1,'session-specific guarded cancellation RPC must exist');
  const reset=async(session='cs_old',status='unpaid')=>{
   await db.exec('truncate orders,parts,order_items,order_events,payment_events,notifications');
   await db.query('insert into orders values($1,$2,$3,$3,$4,null)',[id(1),id(2),status,session]);
   await db.query("insert into parts values($1,$2,0,'reserved');",[id(3),id(4)]);
   await db.query("insert into order_items values($1,$2,$3,1,'pending',null)",[id(5),id(1),id(3)]);
  };
  const cancel=async(session,buyer=id(2),event='buyer_cancelled_checkout')=>(await db.query('select cancel_checkout_order_if_session_matches($1,$2,$3,null,$4) cancelled',[id(1),session,buyer,event])).rows[0].cancelled;
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
  await t.test('both RPCs remain inaccessible to public client roles',async()=>{
   for(const role of ['anon','authenticated','service_role'])for(const name of ['cancel_checkout_order(uuid,text,text)','cancel_checkout_order_if_session_matches(uuid,text,uuid,text,text)']){
    const result=await db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,name]);assert.equal(result.rows[0].allowed,role==='service_role');
   }
  });
 }finally{await db.close();}
});
