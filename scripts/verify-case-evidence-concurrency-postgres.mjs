import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const url=process.env.TEST_DATABASE_URL;
const target=new URL(url);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/secondpart_evidence_rc')throw new Error('Disposable local secondpart_evidence_rc required');
const pg=await import(pathToFileURL(process.env.PG_CLIENT_MODULE).href);
const Client=pg.Client??pg.default.Client;
const clients=Array.from({length:3},()=>new Client({connectionString:url,statement_timeout:15000}));
const [db,a,b]=clients;
const c='11111111-1111-4111-8111-111111111111',u='22222222-2222-4222-8222-222222222222';
const path=n=>`${c}/${u}/33333333-3333-4333-8333-${String(n).padStart(12,'0')}.jpg`;
const read=n=>fs.readFileSync(new URL('../supabase/migrations/'+n,import.meta.url),'utf8');
const register=(client,n)=>client.query('select register_transaction_case_evidence($1,$2,$3,$4)',[c,path(n),'qa.jpg','image/jpeg']);
const queue=(client,n)=>client.query('select queue_orphan_case_evidence_cleanup($1,$2,$3) queued',[c,u,path(n)]);
async function waiting(pid){
 const deadline=Date.now()+5000;
 while(Date.now()<deadline){
  if((await db.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;
  await new Promise(r=>setTimeout(r,20));
 }
 throw new Error('Competing operation did not wait on a lock');
}
try{
 await Promise.all(clients.map(x=>x.connect()));
 assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname in ('public','private')")).rows[0].n,0);
 for(const role of ['anon','authenticated','service_role']){
  if(!(await db.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await db.query('create role '+role);
 }
 await db.query(`create schema private; create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${u}'::uuid$$;
 create function private.can_upload_case_evidence_object(text) returns boolean language sql as $$select true$$;
 create table orders(id uuid primary key,buyer_id uuid);
 create table sellers(id uuid primary key,owner_id uuid);
 create table order_items(id uuid primary key,order_id uuid,seller_id uuid);
 create table transaction_cases(id uuid primary key,order_item_id uuid);
 create table transaction_case_evidence(id uuid default gen_random_uuid(),case_id uuid,uploader_profile_id uuid,storage_path text unique,original_name text,mime_type text);
 insert into orders values('${c}','${u}'); insert into sellers values('${c}','${c}');
 insert into order_items values('${c}','${c}','${c}'); insert into transaction_cases values('${c}','${c}');`);
 const original=read('20260906201500_private_case_evidence.sql');
 await db.query(original.slice(original.indexOf('create or replace function public.register_transaction_case_evidence(')));
 await db.query(read('20260918154500_case_evidence_cleanup_outbox.sql'));
 await db.query(read('20260921140000_case_evidence_cleanup_registration_guard.sql'));
 const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
 await a.query('begin'); await register(a,1);
 const q=queue(b,1); await waiting(pid); await a.query('commit');
 assert.equal((await q).rows[0].queued,false);
 console.log('PASS registration wins: cleanup waits and refuses attached evidence');
 await a.query('begin'); await queue(a,2);
 const r=register(b,2).then(()=>null,e=>e); await waiting(pid); await a.query('commit');
 assert.match((await r)?.message??'',/retired/);
 console.log('PASS cleanup wins: registration waits then rejects retired path');
 console.log('PostgreSQL '+(await db.query('show server_version')).rows[0].server_version);
}finally{
 await a.query('rollback').catch(()=>{}); await Promise.all(clients.map(x=>x.end().catch(()=>{})));
}
