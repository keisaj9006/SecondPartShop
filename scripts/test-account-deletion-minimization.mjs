import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';

const root=path.resolve(import.meta.dirname,'..');
const baseline=process.argv.includes('--baseline');
const migrationName=baseline
 ?'20260909235900_account_deletion_privacy_finalization.sql'
 :'20260912215057_account_deletion_seller_minimization.sql';

const ids={
 privateProfile:'10000000-0000-4000-8000-000000000001',
 businessProfile:'10000000-0000-4000-8000-000000000002',
 blockedProfile:'10000000-0000-4000-8000-000000000003',
 mismatchProfile:'10000000-0000-4000-8000-000000000004',
 unrelatedProfile:'10000000-0000-4000-8000-000000000005',
 privateSeller:'20000000-0000-4000-8000-000000000001',
 businessSeller:'20000000-0000-4000-8000-000000000002',
 blockedSeller:'20000000-0000-4000-8000-000000000003',
 mismatchSeller:'20000000-0000-4000-8000-000000000004',
 unrelatedSeller:'20000000-0000-4000-8000-000000000005',
 garage:'30000000-0000-4000-8000-000000000001',
 privateDonor:'40000000-0000-4000-8000-000000000001',
 blockedDonor:'40000000-0000-4000-8000-000000000003',
 mismatchDonor:'40000000-0000-4000-8000-000000000004',
 unrelatedDonor:'40000000-0000-4000-8000-000000000005',
 privateImport:'50000000-0000-4000-8000-000000000001',
 blockedImport:'50000000-0000-4000-8000-000000000003',
 mismatchImport:'50000000-0000-4000-8000-000000000004',
 unrelatedImport:'50000000-0000-4000-8000-000000000005',
 privatePart:'60000000-0000-4000-8000-000000000001',
 privateOrder:'70000000-0000-4000-8000-000000000001',
 privateOrderItem:'80000000-0000-4000-8000-000000000001',
 privateRequest:'90000000-0000-4000-8000-000000000001',
 businessRequest:'90000000-0000-4000-8000-000000000002',
 blockedRequest:'90000000-0000-4000-8000-000000000003',
 mismatchRequest:'90000000-0000-4000-8000-000000000004'
};

function migration(name){
 return fs.readFileSync(path.join(root,'supabase','migrations',name),'utf8');
}

function prepareBundle(source){
 const definition=[...source.matchAll(/create or replace function public\.prepare_claimed_account_deletion\([\s\S]*?\$\$;/gi)];
 const revoke=[...source.matchAll(/revoke all on function public\.prepare_claimed_account_deletion\(uuid,uuid\) from [^;]+;/gi)];
 const grant=[...source.matchAll(/grant execute on function public\.prepare_claimed_account_deletion\(uuid,uuid\) to service_role;/gi)];
 assert.equal(definition.length,1,`${migrationName}: one prepare function definition required`);
 assert.equal(revoke.length,1,`${migrationName}: one explicit execute revocation required`);
 assert.equal(grant.length,1,`${migrationName}: one service-role grant required`);
 return `${definition[0][0]}\n${revoke[0][0]}\n${grant[0][0]}`;
}

async function asRole(db,role,sql,params=[]){
 await db.exec(`set role ${role}`);
 try{return await db.query(sql,params);}finally{await db.exec('reset role');}
}

async function seller(db,id){
 return (await db.query('select * from public.sellers where id=$1',[id])).rows[0];
}

async function buildDatabase(){
 const db=new PGlite();
 await db.exec(`
  create schema private;
  revoke all on schema private from public;
  create role anon nologin nosuperuser nobypassrls;
  create role authenticated nologin nosuperuser nobypassrls;
  create role service_role nologin nosuperuser bypassrls;
  grant usage on schema public to anon,authenticated,service_role;

  create type public.listing_status as enum ('draft','active','reserved','sold','archived');
  create table public.account_deletion_requests(
   id uuid primary key,profile_id uuid,target_profile_id uuid,status text not null,
   cleanup_seller_ids uuid[] not null default '{}',cleanup_garage_partner_ids uuid[] not null default '{}',
   blocker_code text,processing_started_at timestamptz,updated_at timestamptz not null default now()
  );
  create table public.sellers(
   id uuid primary key,owner_id uuid unique,business_name text not null check(char_length(business_name) between 2 and 140),
   slug text not null unique check(slug~'^[a-z0-9]+(?:-[a-z0-9]+)*$'),location text not null,postcode text,
   description text not null default '',verified_at timestamptz,latitude double precision,longitude double precision,
   postcode_geocoded_at timestamptz,postcode_geocode_approximate boolean not null default false,
   seller_type text not null check(seller_type in ('private','business')),account_deleted_at timestamptz
  );
  create table public.garage_partners(
   id uuid primary key,owner_id uuid unique,business_name text not null check(char_length(btrim(business_name)) between 2 and 140),
   slug text not null unique check(slug~'^[a-z0-9]+(?:-[a-z0-9]+)*$'),location text not null,
   postcode text not null,description text not null,verified_at timestamptz,latitude double precision,longitude double precision,status text not null
  );
  create table public.seller_inventory_imports(
   id uuid primary key,seller_id uuid not null references public.sellers(id),source_channel text not null,
   filename text,status text not null,rows_received integer not null,rows_created integer not null,
   rows_rejected integer not null,error_summary jsonb not null,created_at timestamptz not null default now()
  );
  create table public.donor_vehicles(
   id uuid primary key,seller_id uuid not null references public.sellers(id),registration text,make text not null,
   model text not null,variant text,year smallint not null,fuel_type text,engine_size_simple integer,colour text,notes text
  );
  create table public.parts(
   id uuid primary key,seller_id uuid not null references public.sellers(id),donor_vehicle_id uuid references public.donor_vehicles(id),
   import_batch_id uuid references public.seller_inventory_imports(id),status public.listing_status not null
  );
  create table public.part_images(id uuid primary key,part_id uuid not null references public.parts(id));
  create table public.seller_payment_accounts(seller_id uuid primary key references public.sellers(id),provider_account_id text not null);
  create table public.orders(
   id uuid primary key,buyer_id uuid,total_pence integer not null,currency text not null,payment_status text not null,
   stripe_checkout_session_id text,stripe_payment_intent_id text,shipping_name text,shipping_address jsonb
  );
  create table public.order_items(
   id uuid primary key,order_id uuid not null references public.orders(id),part_id uuid not null references public.parts(id),
   seller_id uuid not null references public.sellers(id),unit_price_pence integer not null,stripe_transfer_id text
  );
  create table public.fitting_requests(id uuid primary key,buyer_id uuid,vehicle_registration text,buyer_notes text);
  create table public.listing_conversations(id uuid primary key,buyer_id uuid,seller_id uuid references public.sellers(id));
  create table public.transaction_reviews(id uuid primary key,reviewer_id uuid,reviewee_id uuid);
  create table private.deletion_blockers(profile_id uuid primary key,code text not null);
  create function private.account_deletion_blocker(p_profile_id uuid)
  returns text language sql stable security definer set search_path=''
  as $$select b.code from private.deletion_blockers b where b.profile_id=p_profile_id$$;
  revoke all on function private.account_deletion_blocker(uuid) from public;
 `);
 await db.exec(prepareBundle(migration(migrationName)));
 return db;
}

async function seed(db){
 await db.query(`insert into public.sellers
  (id,owner_id,business_name,slug,location,postcode,description,verified_at,latitude,longitude,postcode_geocoded_at,postcode_geocode_approximate,seller_type)
  values
  ($1,$2,'Joanne Private','joanne-private-parts','Leeds home','LS1 1AA','Call Joanne',now(),53.8,-1.5,now(),true,'private'),
  ($3,$4,'Registered Recycler Ltd','registered-recycler','Bristol yard','BS1 1AA','Business description',now(),51.4,-2.5,now(),true,'business'),
  ($5,$6,'Blocked Person','blocked-person','Blocked home','B1 1AA','Blocked description',now(),52,-1,now(),true,'private'),
  ($7,$8,'Mismatch Person','mismatch-person','Mismatch home','M1 1AA','Mismatch description',now(),53,-2,now(),true,'private'),
  ($9,$10,'Unrelated Person','unrelated-person','Unrelated home','U1 1AA','Unrelated description',now(),54,-3,now(),true,'private')`,[
   ids.privateSeller,ids.privateProfile,ids.businessSeller,ids.businessProfile,ids.blockedSeller,ids.blockedProfile,
   ids.mismatchSeller,ids.mismatchProfile,ids.unrelatedSeller,ids.unrelatedProfile
  ]);
 await db.query(`insert into public.garage_partners
  (id,owner_id,business_name,slug,location,postcode,description,verified_at,latitude,longitude,status)
  values($1,$2,'Registered Garage Ltd','joannes-garage','Leeds home','LS1 1AA','Private fitting description',now(),53.8,-1.5,'suspended')`,[ids.garage,ids.privateProfile]);
 await db.query(`insert into public.donor_vehicles(id,seller_id,registration,make,model,variant,year,fuel_type,engine_size_simple,colour,notes)
  values($1,$2,'AB12CDE','Ford','Focus','Titanium',2010,'Diesel',2000,'Blue','Bought from Joanne at home'),
   ($3,$4,'BL03CKD','Ford','Fiesta','Zetec',2012,'Petrol',1400,'Red','Blocked seller private note'),
  ($5,$6,'MM04TCH','Vauxhall','Astra','Elite',2014,'Diesel',1600,'Grey','Mismatch seller private note'),
  ($7,$8,'ZZ99ZZZ','BMW','3 Series','Sport',2015,'Petrol',2000,'Black','Unrelated technical note')`,[
   ids.privateDonor,ids.privateSeller,ids.blockedDonor,ids.blockedSeller,
   ids.mismatchDonor,ids.mismatchSeller,ids.unrelatedDonor,ids.unrelatedSeller
  ]);
 await db.query(`insert into public.seller_inventory_imports
  (id,seller_id,source_channel,filename,status,rows_received,rows_created,rows_rejected,error_summary)
  values($1,$2,'csv','joanne-stock.csv','partial',10,8,2,'[{"row":2,"message":"Registration AB12CDE belongs to Joanne"}]'),
  ($3,$4,'csv','blocked-person-stock.csv','failed',3,0,3,'[{"row":1,"message":"Blocked Person BL03CKD"}]'),
   ($5,$6,'csv','mismatch-person-stock.csv','partial',4,2,2,'[{"row":2,"message":"Mismatch Person MM04TCH"}]'),
  ($7,$8,'csv','unrelated-stock.csv','completed',5,5,0,'[]')`,[
   ids.privateImport,ids.privateSeller,ids.blockedImport,ids.blockedSeller,
   ids.mismatchImport,ids.mismatchSeller,ids.unrelatedImport,ids.unrelatedSeller
  ]);
 await db.query(`insert into public.parts(id,seller_id,donor_vehicle_id,import_batch_id,status)
  values($1,$2,$3,$4,'archived')`,[ids.privatePart,ids.privateSeller,ids.privateDonor,ids.privateImport]);
 await db.query(`insert into public.part_images values('61000000-0000-4000-8000-000000000001',$1)`,[ids.privatePart]);
 await db.query(`insert into public.seller_payment_accounts values($1,'acct_private_provider')`,[ids.privateSeller]);
 await db.query(`insert into public.orders
  (id,buyer_id,total_pence,currency,payment_status,stripe_checkout_session_id,stripe_payment_intent_id,shipping_name,shipping_address)
  values($1,$2,12999,'gbp','paid','cs_test_audit','pi_test_audit','Joanne Private','{"line1":"Home"}')`,[ids.privateOrder,ids.privateProfile]);
 await db.query(`insert into public.order_items values($1,$2,$3,$4,12999,'tr_test_audit')`,[
  ids.privateOrderItem,ids.privateOrder,ids.privatePart,ids.privateSeller
 ]);
 await db.query(`insert into public.fitting_requests values('81000000-0000-4000-8000-000000000001',$1,'AB12CDE','Call Joanne')`,[ids.privateProfile]);
 await db.query(`insert into public.listing_conversations values('82000000-0000-4000-8000-000000000001',$1,$2)`,[ids.privateProfile,ids.privateSeller]);
 await db.query(`insert into public.transaction_reviews values('83000000-0000-4000-8000-000000000001',$1,$2)`,[ids.unrelatedProfile,ids.privateProfile]);
 await db.query(`insert into public.account_deletion_requests
  (id,profile_id,target_profile_id,status,cleanup_seller_ids,cleanup_garage_partner_ids,processing_started_at)
  values
  ($1,$2,$2,'processing',array[$3]::uuid[],array[$4]::uuid[],now()),
  ($5,$6,$6,'processing',array[$7]::uuid[],'{}',now()),
  ($8,$9,$9,'processing',array[$10]::uuid[],'{}',now()),
  ($11,$12,$12,'processing',array[$13]::uuid[],'{}',now())`,[
   ids.privateRequest,ids.privateProfile,ids.privateSeller,ids.garage,
   ids.businessRequest,ids.businessProfile,ids.businessSeller,
   ids.blockedRequest,ids.blockedProfile,ids.blockedSeller,
   ids.mismatchRequest,ids.mismatchProfile,ids.mismatchSeller
  ]);
 await db.query(`insert into private.deletion_blockers values($1,'seller_commerce_active')`,[ids.blockedProfile]);
}

test(`account-deletion minimization uses real ${baseline?'pre-fix':'candidate'} SQL on a reduced schema`,async(t)=>{
 const db=await buildDatabase();
 try{
  await seed(db);
  t.diagnostic('PGlite is a reduced PostgreSQL 18 schema; hosted PostgreSQL 17/RLS/Storage/Auth remain separate release gates.');

  const privileges=(await db.query(`select
   has_function_privilege('anon','public.prepare_claimed_account_deletion(uuid,uuid)','execute') anon,
   has_function_privilege('authenticated','public.prepare_claimed_account_deletion(uuid,uuid)','execute') authenticated,
   has_function_privilege('service_role','public.prepare_claimed_account_deletion(uuid,uuid)','execute') service`)).rows[0];
  assert.deepEqual(privileges,{anon:false,authenticated:false,service:true});
  for(const role of ['anon','authenticated']){
   await assert.rejects(asRole(db,role,'select public.prepare_claimed_account_deletion($1,$2)',[ids.privateRequest,ids.privateProfile]),/permission denied/i);
  }

  await assert.rejects(
   asRole(db,'service_role','select public.prepare_claimed_account_deletion($1,$2)',[ids.mismatchRequest,ids.privateProfile]),
   /not claimed for this profile/i
  );
  assert.equal((await seller(db,ids.mismatchSeller)).business_name,'Mismatch Person');
  assert.deepEqual((await db.query('select registration,notes from public.donor_vehicles where id=$1',[ids.mismatchDonor])).rows[0],{
   registration:'MM04TCH',notes:'Mismatch seller private note'
  });
  assert.deepEqual((await db.query('select filename,error_summary from public.seller_inventory_imports where id=$1',[ids.mismatchImport])).rows[0],{
   filename:'mismatch-person-stock.csv',error_summary:[{row:2,message:'Mismatch Person MM04TCH'}]
  });

  const blocked=await asRole(db,'service_role','select public.prepare_claimed_account_deletion($1,$2) result',[ids.blockedRequest,ids.blockedProfile]);
  assert.equal(blocked.rows[0].result,false);
  assert.equal((await seller(db,ids.blockedSeller)).business_name,'Blocked Person');
  assert.deepEqual((await db.query('select registration,notes from public.donor_vehicles where id=$1',[ids.blockedDonor])).rows[0],{
   registration:'BL03CKD',notes:'Blocked seller private note'
  });
  assert.deepEqual((await db.query('select filename,error_summary from public.seller_inventory_imports where id=$1',[ids.blockedImport])).rows[0],{
   filename:'blocked-person-stock.csv',error_summary:[{row:1,message:'Blocked Person BL03CKD'}]
  });
  assert.deepEqual((await db.query('select status,blocker_code from public.account_deletion_requests where id=$1',[ids.blockedRequest])).rows[0],{
   status:'blocked',blocker_code:'seller_commerce_active'
  });

  const prepared=await asRole(db,'service_role','select public.prepare_claimed_account_deletion($1,$2) result',[ids.privateRequest,ids.privateProfile]);
  assert.equal(prepared.rows[0].result,true);
  const minimized=await seller(db,ids.privateSeller);
  assert.equal(minimized.business_name,'Deleted seller');
  assert.equal(minimized.slug,'deleted-seller-20000000000040008000000000000001');
  assert.equal(minimized.location,'Deleted');
  assert.equal(minimized.postcode,null);
  assert.equal(minimized.description,'');
  assert.equal(minimized.verified_at,null);
  assert.ok(minimized.account_deleted_at);

  const garage=(await db.query('select * from public.garage_partners where id=$1',[ids.garage])).rows[0];
  assert.equal(garage.business_name,'Registered Garage Ltd');
  assert.equal(garage.slug,'deleted-garage-30000000000040008000000000000001');
  assert.equal(garage.location,'Deleted');
  const donor=(await db.query('select * from public.donor_vehicles where id=$1',[ids.privateDonor])).rows[0];
  assert.equal(donor.registration,null);
  assert.equal(donor.notes,null);
  assert.deepEqual({make:donor.make,model:donor.model,variant:donor.variant,year:donor.year},{make:'Ford',model:'Focus',variant:'Titanium',year:2010});
  const imported=(await db.query('select * from public.seller_inventory_imports where id=$1',[ids.privateImport])).rows[0];
  assert.equal(imported.filename,null);
  assert.deepEqual(imported.error_summary,[]);
  assert.deepEqual({status:imported.status,rows_received:imported.rows_received,rows_created:imported.rows_created,rows_rejected:imported.rows_rejected},{status:'partial',rows_received:10,rows_created:8,rows_rejected:2});

  const audit=(await db.query(`select o.total_pence,o.currency,o.payment_status,o.stripe_checkout_session_id,o.stripe_payment_intent_id,
   o.shipping_name,o.shipping_address,oi.stripe_transfer_id,oi.unit_price_pence,p.seller_id,p.donor_vehicle_id,p.import_batch_id
   from public.orders o join public.order_items oi on oi.order_id=o.id join public.parts p on p.id=oi.part_id where o.id=$1`,[ids.privateOrder])).rows[0];
  assert.deepEqual(audit,{
   total_pence:12999,currency:'gbp',payment_status:'paid',stripe_checkout_session_id:'cs_test_audit',
   stripe_payment_intent_id:'pi_test_audit',shipping_name:null,shipping_address:null,
   stripe_transfer_id:'tr_test_audit',unit_price_pence:12999,seller_id:ids.privateSeller,
   donor_vehicle_id:ids.privateDonor,import_batch_id:ids.privateImport
  });
  assert.equal((await db.query('select count(*)::integer count from public.listing_conversations')).rows[0].count,0);
  assert.equal((await db.query('select count(*)::integer count from public.transaction_reviews')).rows[0].count,0);
  assert.equal((await db.query('select count(*)::integer count from public.seller_payment_accounts')).rows[0].count,0);

  const firstTombstone={business_name:minimized.business_name,slug:minimized.slug,location:minimized.location};
  assert.equal((await asRole(db,'service_role','select public.prepare_claimed_account_deletion($1,$2) result',[ids.privateRequest,ids.privateProfile])).rows[0].result,true);
  const retried=await seller(db,ids.privateSeller);
  assert.deepEqual({business_name:retried.business_name,slug:retried.slug,location:retried.location},firstTombstone);
  assert.equal((await db.query('select count(*)::integer count from public.parts where id=$1',[ids.privatePart])).rows[0].count,1);
  assert.equal((await db.query('select count(*)::integer count from public.donor_vehicles where id=$1',[ids.privateDonor])).rows[0].count,1);
  assert.equal((await db.query('select count(*)::integer count from public.seller_inventory_imports where id=$1',[ids.privateImport])).rows[0].count,1);

  assert.equal((await asRole(db,'service_role','select public.prepare_claimed_account_deletion($1,$2) result',[ids.businessRequest,ids.businessProfile])).rows[0].result,true);
  const retainedBusiness=await seller(db,ids.businessSeller);
  assert.equal(retainedBusiness.business_name,'Registered Recycler Ltd');
  assert.equal(retainedBusiness.slug,'deleted-seller-20000000000040008000000000000002');
  assert.equal(retainedBusiness.location,'Deleted');

  const unrelated=await seller(db,ids.unrelatedSeller);
  assert.deepEqual({business_name:unrelated.business_name,slug:unrelated.slug,location:unrelated.location,postcode:unrelated.postcode,description:unrelated.description},{
   business_name:'Unrelated Person',slug:'unrelated-person',location:'Unrelated home',postcode:'U1 1AA',description:'Unrelated description'
  });
  assert.deepEqual((await db.query('select registration,notes from public.donor_vehicles where id=$1',[ids.unrelatedDonor])).rows[0],{
   registration:'ZZ99ZZZ',notes:'Unrelated technical note'
  });
  assert.deepEqual((await db.query('select filename,error_summary from public.seller_inventory_imports where id=$1',[ids.unrelatedImport])).rows[0],{
   filename:'unrelated-stock.csv',error_summary:[]
  });
 }finally{await db.close();}
});
