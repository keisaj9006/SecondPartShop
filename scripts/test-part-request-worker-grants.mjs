import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {PGlite} from "@electric-sql/pglite";

// Isolated ACL fixture: exercises PostgreSQL permission semantics, not the
// worker bodies, PG17 parity, cron delivery, or hosted RLS/E2E acceptance.
const migration=readFileSync(new URL("../supabase/migrations/20261109162343_restrict_part_request_worker_execute.sql",import.meta.url),"utf8");
const signatures=[
 "private.enqueue_part_request_refresh_for_part_signals(uuid[],text[],uuid[])",
 "private.process_part_request_refresh_queue(integer)",
 "private.refresh_seller_part_request_matches(uuid)"
];
async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema private; grant usage on schema private to anon,authenticated,service_role;
 create table private.calls(id integer);
 create function private.refresh_seller_part_request_matches(uuid) returns void
 language sql security definer set search_path='' as $$insert into private.calls values(1)$$;
 create function private.enqueue_part_request_refresh_for_part_signals(uuid[],text[],uuid[]) returns void
 language sql security definer set search_path='' as $$insert into private.calls values(2)$$;
 create function private.process_part_request_refresh_queue(integer) returns integer
 language sql security definer set search_path='' as $$select 3$$;
 create function private.trigger_fixture() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform private.refresh_seller_part_request_matches(new.id); return new; end$$;
 create table public.fixture(id uuid); grant insert on public.fixture to authenticated;
 create trigger invoke_owned_worker after insert on public.fixture for each row execute function private.trigger_fixture();
 create function public.intentional_read() returns integer language sql security definer set search_path='' as $$select 7$$;
 `);
 await db.exec(migration);
 return db;
}
test("client roles cannot directly invoke internal request workers, including via PUBLIC inheritance",async t=>{
 const db=await fixture(t);
 for(const role of ["anon","authenticated"]){
  for(const signature of signatures){
   const {rows}=await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature]);
   assert.equal(rows[0].allowed,false,role+" must not execute "+signature);
  }
  await db.exec("set role "+role);
  try{await assert.rejects(db.query("select private.process_part_request_refresh_queue(1)"),/permission denied/);}
  finally{await db.exec("reset role");}
 }
});
test("owner-trigger execution, cron owner and service-role access survive revocation",async t=>{
 const db=await fixture(t);
 for(const signature of signatures){
  const {rows}=await db.query("select has_function_privilege('service_role',$1,'EXECUTE') allowed",[signature]);
  assert.equal(rows[0].allowed,true);
 }
 await db.exec("set role authenticated; insert into public.fixture values('a1234567-1234-4123-8123-123456789abc'); reset role;");
 assert.equal((await db.query("select count(*)::int n from private.calls")).rows[0].n,1);
 assert.equal((await db.query("select private.process_part_request_refresh_queue(1) n")).rows[0].n,3);
});
test("reapplying the forward migration is safe and does not revoke intentional public RPCs",async t=>{
 const db=await fixture(t);await db.exec(migration);
 await db.exec("set role anon");
 assert.equal((await db.query("select public.intentional_read() n")).rows[0].n,7);
 await db.exec("reset role");
});
