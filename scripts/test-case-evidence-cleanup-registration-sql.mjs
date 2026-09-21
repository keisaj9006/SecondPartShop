import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
const migrations=new URL('../supabase/migrations/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,migrations),'utf8');
const caseId='11111111-1111-4111-8111-111111111111';
const buyer='22222222-2222-4222-8222-222222222222';
const path=n=>`${caseId}/${buyer}/33333333-3333-4333-8333-${String(n).padStart(12,'0')}.jpg`;
test('evidence registration cannot race durable cleanup authority',async t=>{
 const db=new PGlite();
 await db.exec(`create schema private; create schema auth;
 create role anon; create role authenticated; create role service_role;
 create function auth.uid() returns uuid language sql as $$select '${buyer}'::uuid$$;
 create function private.can_upload_case_evidence_object(text) returns boolean language sql as $$select true$$;
 create table orders(id uuid primary key,buyer_id uuid);
 create table sellers(id uuid primary key,owner_id uuid);
 create table order_items(id uuid primary key,order_id uuid,seller_id uuid);
 create table transaction_cases(id uuid primary key,order_item_id uuid);
 create table transaction_case_evidence(id uuid default gen_random_uuid(),case_id uuid,uploader_profile_id uuid,storage_path text unique,original_name text,mime_type text);
 insert into orders values('${caseId}','${buyer}');
 insert into sellers values('${caseId}','${caseId}');
 insert into order_items values('${caseId}','${caseId}','${caseId}');
 insert into transaction_cases values('${caseId}','${caseId}');`);
 const original=read('20260906201500_private_case_evidence.sql');
 await db.exec(original.slice(original.indexOf('create or replace function public.register_transaction_case_evidence(')));
 await db.exec(read('20260918154500_case_evidence_cleanup_outbox.sql'));
 const patch=fs.readdirSync(migrations).find(n=>n.endsWith('_case_evidence_cleanup_registration_guard.sql'));
 if(patch)await db.exec(read(patch));
 const register=p=>db.query('select register_transaction_case_evidence($1,$2,$3,$4)',[caseId,p,'qa.jpg','image/jpeg']);
 const queue=p=>db.query('select queue_orphan_case_evidence_cleanup($1,$2,$3) queued',[caseId,buyer,p]);
 try {
 await t.test('registration first refuses cleanup authority',async()=>{
  await register(path(1)); assert.equal((await queue(path(1))).rows[0].queued,false);
 });
 await t.test('cleanup selected first rejects delayed registration',async()=>{
  await queue(path(2));
  assert.equal((await db.query('select * from get_case_evidence_cleanup_queue(50,$1)',[path(2)])).rows.length,1);
  await assert.rejects(register(path(2)),/cleanup|retired/i);
 });
 await t.test('completed cleanup path can never be reattached',async()=>{
  await queue(path(3)); await db.query('select complete_case_evidence_cleanup($1)',[path(3)]);
  await assert.rejects(register(path(3)),/cleanup|retired/i);
 });
 await t.test('storage path update cannot attach a retired path',async()=>{
  await register(path(4)); await queue(path(5));
  await assert.rejects(db.query('update transaction_case_evidence set storage_path=$1 where storage_path=$2',[path(5),path(4)]),/cleanup|retired/i);
 });
 } finally {await db.close();}
});
