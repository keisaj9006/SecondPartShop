import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(path.join(root, "supabase/migrations/20261014202700_review_ready_notifications_forward.sql"), "utf8");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const buyer = id(1), seller = id(2), outsider = id(3), order = id(4), sellerId = id(5), part = id(6);

test("RC-04 review-ready: transition matrix, recipient isolation, dedupe, ACL, and rollback", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create schema private; revoke all on schema private from public;
      create table public.orders(id uuid primary key,buyer_id uuid not null,payment_status text not null);
      create table public.sellers(id uuid primary key,owner_id uuid not null);
      create table public.parts(id uuid primary key,title text not null);
      create table public.order_items(
        id uuid primary key,order_id uuid not null,seller_id uuid not null,part_id uuid not null,
        payout_status text not null,funds_released_at timestamptz,fulfilment_status text not null,
        refunded_at timestamptz,note text
      );
      create table public.transaction_cases(id uuid primary key,order_item_id uuid not null,status text not null);
      create table public.notifications(
        id bigint generated always as identity primary key,profile_id uuid not null,type text not null,
        title text not null,body text,href text,dedupe_key text,
        unique(profile_id,dedupe_key)
      );
      insert into public.orders values ('${order}','${buyer}','paid');
      insert into public.sellers values ('${sellerId}','${seller}');
      insert into public.parts values ('${part}','Used alternator');
    `);
    await db.exec(migration);
    const metadata = (await db.query(`
      select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
        has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,
        pg_get_triggerdef(t.oid) trigger_def
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      join pg_trigger t on t.tgfoid=p.oid
      where n.nspname='private' and p.proname='notify_transaction_review_ready'
    `)).rows;
    assert.equal(metadata.length, 2);
    assert.ok(metadata.every((row) => row.prosecdef === true));
    assert.ok(metadata.every((row) => JSON.stringify(row.proconfig) === JSON.stringify(['search_path=""'])));
    assert.ok(metadata.every((row) => row.anon_exec === false && row.authenticated_exec === false));
    assert.ok(metadata.some((row) => /AFTER UPDATE OF payout_status, funds_released_at, fulfilment_status, refunded_at ON public.order_items FOR EACH ROW/.test(row.trigger_def)));
    assert.ok(metadata.some((row) => /AFTER UPDATE OF status ON public.transaction_cases FOR EACH ROW/.test(row.trigger_def)));

    const a = id(10), b = id(11), c = id(12), d = id(13), old = id(14), later = id(15);
    await db.exec(`
      insert into public.order_items values
        ('${a}','${order}','${sellerId}','${part}','scheduled',null,'completed',null,null),
        ('${b}','${order}','${sellerId}','${part}','released',null,'completed',null,null),
        ('${c}','${order}','${sellerId}','${part}','released',now(),'preparing',null,null),
        ('${d}','${order}','${sellerId}','${part}','scheduled',null,'preparing',null,null),
        ('${old}','${order}','${sellerId}','${part}','released',now(),'completed',null,null);
      insert into public.notifications(profile_id,type,title,href,dedupe_key)
        values ('${buyer}','account','Previously queued','/account/reviews','review-ready:${a}:buyer');
      update public.order_items set payout_status='released',funds_released_at=now() where id='${a}';
      update public.order_items set funds_released_at=now() where id='${b}';
      update public.order_items set fulfilment_status='completed' where id='${c}';
      update public.order_items set payout_status='released' where id='${d}';
      update public.order_items set note='unrelated' where id='${old}';
      update public.order_items set payout_status='released' where id='${old}';
    `);
    const rows = (await db.query(`select profile_id,dedupe_key,type,href,body from public.notifications order by dedupe_key`)).rows;
    assert.equal(rows.length, 6); // Existing buyer key plus seller A and both participants B/C.
    assert.equal(rows.filter((r) => r.profile_id === outsider).length, 0);
    assert.equal(rows.filter((r) => r.dedupe_key.includes(old)).length, 0); // No retroactive backfill.
    assert.equal(rows.filter((r) => r.dedupe_key.includes(d)).length, 0); // Funds remain unreleased.
    assert.deepEqual(rows.filter((r) => r.dedupe_key.includes(a)).map((r) => r.profile_id).sort(), [buyer, seller]);
    assert.ok(rows.every((r) => r.type === "account" && r.href === "/account/reviews"));
    assert.ok(rows.filter((r) => r.body).every((r) => r.body.includes("Used alternator")));

    await db.exec(`
      update public.order_items set payout_status='released',funds_released_at=now() where id='${a}';
      update public.order_items set payout_status='scheduled' where id='${a}';
      update public.order_items set payout_status='released' where id='${a}';
      update public.order_items set payout_status='reversed' where id='${b}';
    `);
    assert.equal((await db.query("select count(*)::int n from public.notifications")).rows[0].n, 6);

    // Rollback rehearsal is local only. It stops future notifications and retains the audit trail.
    await db.exec(`drop trigger transaction_review_ready_notification on public.order_items; drop trigger transaction_case_review_ready_notification on public.transaction_cases; drop function private.notify_transaction_review_ready();`);
    await db.exec(`insert into public.order_items values ('${later}','${order}','${sellerId}','${part}','scheduled',null,'completed',null,null); update public.order_items set payout_status='released',funds_released_at=now() where id='${later}';`);
    assert.equal((await db.query("select count(*)::int n from public.notifications")).rows[0].n, 6);
  } finally {
    await db.close();
  }
});
