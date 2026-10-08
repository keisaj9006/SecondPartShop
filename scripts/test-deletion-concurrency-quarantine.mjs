import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {makeConcurrencyManifest,fixtureSetup,fixtureReset,raceQueries,fixtureCleanup} from './build-hosted-deletion-concurrency.mjs';
const input={buyer:'11111111-1111-4111-8111-111111111111',garageOwner:'22222222-2222-4222-8222-222222222222',stranger:'33333333-3333-4333-8333-333333333333',runId:'rc26-isolated-guard'};
test('quarantined generator refuses absent, shared, remote and ambiguous targets',()=>{
 for(const isolatedDatabaseUrl of [undefined,'postgresql://postgres@example.supabase.co/postgres','postgresql://postgres@127.0.0.1/postgres','postgresql://postgres@10.0.0.2/secondpart_deletion_rc','https://localhost/secondpart_deletion_rc','postgresql://postgres@localhost/secondpart_deletion_rc?host=example.supabase.co']){
  assert.throws(()=>makeConcurrencyManifest({...input,isolatedDatabaseUrl}),/isolated/i);
 }
});
test('every exported mutating builder revalidates isolation',()=>{
 const m=makeConcurrencyManifest({...input,isolatedDatabaseUrl:'postgresql://postgres@localhost/secondpart_deletion_rc'});
 delete m.isolatedDatabaseUrl;
 for(const build of [fixtureSetup,fixtureReset,fixtureCleanup,x=>raceQueries(x,{kind:'checkout',first:'creation',index:1})])assert.throws(()=>build(m),/isolated/i);
});
test('generated SQL also refuses a shared database before any fixture statement',async()=>{
 const m=makeConcurrencyManifest({...input,isolatedDatabaseUrl:'postgresql://postgres@localhost/secondpart_deletion_rc'});
 const race=raceQueries(m,{kind:'checkout',first:'creation',index:1});
 const db=new PGlite();
 try{for(const sql of [fixtureSetup(m),fixtureReset(m),fixtureCleanup(m),race.a,race.b]){
  await assert.rejects(db.exec(sql),/isolated disposable PostgreSQL 17 database required/i);
  await db.exec('rollback');
 }}finally{await db.close();}
});
