import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const root=path.resolve(import.meta.dirname,'../..');
export const migration=name=>fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8');
// Extract whole named statements, retaining dollar quoted bodies. Exact occurrence
// assertions make dependency drift fail loudly; this is not a full migration replay.
export function definition(source,kind,name){
 const escaped=name.replaceAll('.','\\.');
 const pattern=kind==='function'
  ?new RegExp(`create or replace function ${escaped}\\([\\s\\S]*?\\$\\$;`,'gi')
  :new RegExp(`create table (?:if not exists )?${escaped} \\([\\s\\S]*?;`,'gi');
 const found=[...source.matchAll(pattern)];
 assert.equal(found.length,1,`${kind} ${name}: exactly one complete definition required`);
 return found[0][0];
}
export async function database(){
 const db=new PGlite({extensions:{pg_trgm}});
 try{
 await db.exec(`create schema extensions; create extension pg_trgm with schema extensions;
 create schema auth; create schema private; revoke all on schema private from public;
 create role anon nologin nosuperuser nobypassrls; create role authenticated nologin nosuperuser nobypassrls;
 grant usage on schema public,auth to anon,authenticated; grant usage on schema private to authenticated;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create type public.user_role as enum ('buyer','seller','admin');
 create type public.part_condition as enum ('new','reconditioned','used');
 create type public.listing_status as enum ('draft','active','reserved','sold','archived');
 create type public.vehicle_data_status as enum ('verified','qa_seed','external_import');`);
 const base=migration('20260903142834_marketplace.sql');
 for(const name of ['profiles','sellers','categories','vehicles','parts','part_fitments','orders','order_items'])await db.exec(definition(base,'table',`public.${name}`));
 for(const name of ['is_admin','owns_seller'])await db.exec(definition(base,'function',`private.${name}`));
 await db.exec(`revoke all on function private.is_admin(),private.owns_seller(uuid) from public;
 grant execute on function private.is_admin(),private.owns_seller(uuid) to authenticated;`);
 for(const [file,name] of [
 ['20260904162532_dft_vehicle_catalogue.sql','vehicle_catalogue_variants'],
 ['20260904170926_part_catalogue_fitments.sql','part_catalogue_fitments'],
 ['20260905121511_seller_donor_vehicles.sql','donor_vehicles']
 ])await db.exec(definition(migration(file),'table',`public.${name}`));
 await db.exec(fs.readFileSync(path.join(root,'scripts/fixtures/marketplace-search-schema.sql'),'utf8'));
 for(const file of ['20260905120409_listing_trust_details.sql','20260905122609_local_collection_delivery_eta.sql'])await db.exec(migration(file));
 for(const [file,table] of [['20260906122500_trust_reputation_foundation.sql','transaction_reviews'],['20260906180000_transaction_cases_and_refunds.sql','transaction_cases']])await db.exec(definition(migration(file),'table',`public.${table}`));
 // Full, exact state checks from their declaration migrations; no payment mutation functions.
 for(const [file,table,constraint] of [
 ['20260906122500_trust_reputation_foundation.sql','order_items','order_items_fulfilment_status_check'],
 ['20260906141000_commerce_core_foundation.sql','orders','orders_payment_status_check'],
 ['20260906141000_commerce_core_foundation.sql','order_items','order_items_payout_status_check']
 ]){
  const found=migration(file).match(new RegExp(`alter table public.${table}\\s+add constraint ${constraint}[^;]+;`,'g'));
  assert.equal(found?.length,1);await db.exec(found[0]);
 }
 const returnStates=migration('20260906194500_physical_return_lifecycle.sql');
 await db.exec(returnStates.slice(0,returnStates.indexOf('alter table public.transaction_cases',returnStates.indexOf('check (status'))));
 const policy=migration('20260903143143_advisor_fixes.sql');
 for(const name of ['parts anon read active','parts authenticated read']){
 const statements=policy.match(new RegExp(`create policy "${name}"[^;]+;`,'g'));
 assert.equal(statements?.length,1);await db.exec(statements[0]);
 }
 await db.exec(definition(migration('20260905115729_compatibility_confidence.sql'),'function','public.marketplace_legacy_vehicle_compatibility'));
 await db.exec(migration('20260905121247_marketplace_search_synonyms.sql'));
 const feedback=migration('20260906263000_verified_fit_feedback.sql');
 await db.exec(definition(feedback,'table','public.verified_fit_feedback'));
 const feedbackPolicies=feedback.slice(feedback.indexOf('alter table public.verified_fit_feedback enable'),feedback.indexOf('create or replace function public.prepare_checkout_order_v2'));
 await db.exec(feedbackPolicies);
 await db.exec(definition(feedback,'function','public.marketplace_catalogue_compatibility'));
 for(const name of [
 '20260907125000_catalogue_sorted_marketplace_page.sql',
 '20260907130500_indexed_marketplace_search.sql',
 '20260907163500_filter_invalid_verified_fit_evidence.sql',
 '20260907165000_filter_invalid_transactions_from_public_reputation.sql',
 '20260909100500_indexed_marketplace_search_candidates.sql',
 '20260909202000_catalogue_compatibility_cursor.sql',
 '20260909203500_distance_page_v2.sql',
 '20260911090000_consolidate_seller_read_policy.sql',
 '20260911211956_guard_catalogue_verified_fit_evidence.sql'
 ])await db.exec(migration(name));
 return db;
 }catch(error){await db.close();throw error;}
}
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function seed(db,count=1601){
 await db.exec(`insert into auth.users values ('${id(9001)}'),('${id(9002)}'),('${id(9003)}');
 insert into profiles(id,role,display_name) values ('${id(9001)}','admin','Test admin'),('${id(9002)}','buyer','Buyer two'),('${id(9003)}','buyer','Buyer three');
 insert into sellers(id,owner_id,business_name,slug,location,latitude,longitude) values ('${id(8001)}','${id(9001)}','Test recycler','test-recycler','Test',55,-3),('${id(8002)}',null,'Near recycler','near-recycler','Test',51,0);
 insert into categories(id,name,slug) values ('${id(7001)}','Components','components'),('${id(7002)}','Selected','selected');
 insert into vehicle_catalogue_variants(id,provider,provider_key,make,model_family,variant,source_reference) values ('${id(6001)}','fixture','one','Test','Model','One','fixture'),('${id(6002)}','fixture','two','Test','Model','Two','fixture');
 insert into vehicles(id,make,model,generation,year,engine,gearbox_family,gearbox_code) values ('${id(5001)}','Test','Model','Gen',2020,'2.0','manual','code');
 insert into parts(id,seller_id,category_id,title,slug,description,condition,price_pence,status,created_at,delivery_days_min,warranty_days)
 select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(8001)}','${id(7001)}','Fixture alternator','part-'||n,'A deterministic fixture description','used',1000,'active','2026-01-01'::timestamptz-n*interval '1 second',5,30 from generate_series(1,${count}) n;`);
}
