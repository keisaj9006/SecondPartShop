import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";

const databaseUrl=process.env.TEST_DATABASE_URL?.trim();
if(!databaseUrl)throw new Error("TEST_DATABASE_URL is required.");

const functionSource=fs.readFileSync("supabase/migrations/20260906163000_checkout_reservation_lifecycle.sql","utf8");
const functionStart=functionSource.indexOf("create or replace function public.prepare_checkout_order(");
const functionEnd=functionSource.indexOf("\n$$;",functionStart);
if(functionStart<0||functionEnd<0)throw new Error("Could not extract prepare_checkout_order from the canonical migration.");
const prepareCheckoutSql=functionSource.slice(functionStart,functionEnd+4);
assert.match(prepareCheckoutSql,/for update of p;/i,"The canonical checkout function must lock the listing row.");

const seller="70000000-0000-4000-8000-000000000001";
const sellerOwner="70000000-0000-4000-8000-000000000002";
const part="70000000-0000-4000-8000-000000000003";
const buyerA="70000000-0000-4000-8000-000000000004";
const buyerB="70000000-0000-4000-8000-000000000005";

function psql(sql,{allowFailure=false,onStdout}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn("psql",[databaseUrl,"-X","-A","-t","-q","-v","ON_ERROR_STOP=1"],{
   env:{...process.env,PGAPPNAME:"secondpart-rc-last-stock"},
   stdio:["pipe","pipe","pipe"]
  });
  let stdout="";
  let stderr="";
  child.stdout.on("data",chunk=>{
   const text=chunk.toString();
   stdout+=text;
   onStdout?.(stdout,text);
  });
  child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
  child.on("error",reject);
  child.on("close",code=>{
   const result={code:code??-1,stdout,stderr};
   if(code===0||allowFailure)resolve(result);
   else reject(new Error(`psql failed (${code}): ${stderr||stdout}`));
  });
  child.stdin.end(sql);
 });
}

const setup=`
 drop schema if exists auth cascade;
 drop schema if exists private cascade;
 drop table if exists public.order_events,public.order_items,public.orders,public.parts,public.sellers,public.commerce_settings cascade;
 drop type if exists public.listing_status cascade;
 drop role if exists authenticated;

 create schema auth;
 create schema private;
 create role authenticated nologin nosuperuser nobypassrls;
 create type public.listing_status as enum ('draft','active','reserved');
 create function auth.uid() returns uuid language sql stable
  as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;

 create table public.sellers(
  id uuid primary key,
  owner_id uuid not null,
  business_name text not null
 );
 create table public.parts(
  id uuid primary key,
  seller_id uuid not null,
  title text not null,
  price_pence integer not null,
  stock integer not null,
  status public.listing_status not null,
  shipping_pence integer not null default 0,
  collection_available boolean not null default false
 );
 create table public.commerce_settings(
  singleton boolean primary key,
  platform_fee_bps integer not null,
  checkout_reservation_minutes integer not null
 );
 create table public.orders(
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid,
  status text not null,
  total_pence integer not null,
  currency text not null,
  subtotal_pence integer not null,
  shipping_pence integer not null,
  platform_fee_pence integer not null,
  payment_status text not null,
  payment_provider text not null,
  checkout_expires_at timestamptz
 );
 create table public.order_items(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  part_id uuid not null,
  seller_id uuid not null,
  quantity integer not null,
  unit_price_pence integer not null,
  fulfilment_status text not null,
  delivery_method text not null,
  shipping_pence integer not null,
  platform_fee_pence integer not null,
  seller_net_pence integer not null,
  payout_status text not null
 );
 create table public.order_events(
  order_id uuid not null,
  order_item_id uuid,
  actor_profile_id uuid,
  event_type text not null,
  to_status text,
  metadata jsonb not null default '{}'::jsonb
 );
 create function public.seller_checkout_ready(uuid) returns boolean
  language sql stable security definer set search_path=''
  as $$select true$$;

 ${prepareCheckoutSql}

 grant usage on schema public,auth to authenticated;
 grant execute on function public.prepare_checkout_order(uuid,integer,text) to authenticated;
 grant execute on function auth.uid() to authenticated;

 insert into public.commerce_settings values(true,500,30);
 insert into public.sellers values('${seller}','${sellerOwner}','RC concurrency seller');
 insert into public.parts(id,seller_id,title,price_pence,stock,status,shipping_pence,collection_available)
 values('${part}','${seller}','RC last-stock fixture',4999,1,'active',399,true);
`;

await psql(setup);

const sessionSql=(buyer,hold)=>`
 begin;
 set local role authenticated;
 select set_config('request.jwt.claim.sub','${buyer}',true);
 select 'ORDER='||order_id::text from public.prepare_checkout_order('${part}'::uuid,1,'shipping');
 ${hold?"\\echo HOLDING_LAST_STOCK_LOCK\n select pg_sleep(2);":""}
 commit;
`;

let releaseHolding;
const holding=new Promise(resolve=>{releaseHolding=resolve;});
const firstPromise=psql(sessionSql(buyerA,true),{
 onStdout:stdout=>{
  if(stdout.includes("HOLDING_LAST_STOCK_LOCK"))releaseHolding();
 }
});

const holdTimeout=setTimeout(()=>releaseHolding(new Error("Timed out waiting for the first checkout to hold the listing lock.")),5000);
await holding;
clearTimeout(holdTimeout);

const secondPromise=psql(sessionSql(buyerB,false),{allowFailure:true});
const [first,second]=await Promise.all([firstPromise,secondPromise]);

assert.equal(first.code,0,"The first buyer must reserve the only unit.");
assert.match(first.stdout,/ORDER=[0-9a-f-]{36}/i,"The first checkout must return a real order id.");
assert.notEqual(second.code,0,"The overlapping second checkout must fail after the first transaction commits.");
assert.match(second.stderr,/listing is not available for checkout/i,"The loser must fail closed because stock is no longer available.");

const stateResult=await psql(`
 select json_build_object(
  'stock',(select stock from public.parts where id='${part}'::uuid),
  'status',(select status::text from public.parts where id='${part}'::uuid),
  'orders',(select count(*) from public.orders),
  'items',(select count(*) from public.order_items),
  'reservation_events',(select count(*) from public.order_events where event_type='checkout_reserved'),
  'buyer_a_orders',(select count(*) from public.orders where buyer_id='${buyerA}'::uuid),
  'buyer_b_orders',(select count(*) from public.orders where buyer_id='${buyerB}'::uuid)
 )::text;
`);
const finalState=JSON.parse(stateResult.stdout.trim());
assert.deepEqual(finalState,{
 stock:0,
 status:"reserved",
 orders:1,
 items:1,
 reservation_events:1,
 buyer_a_orders:1,
 buyer_b_orders:0
});

console.log("PASS: two independent PostgreSQL sessions competed for one unit; exactly one checkout won.");
console.log(JSON.stringify(finalState));
