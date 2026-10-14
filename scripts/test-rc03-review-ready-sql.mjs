import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(path.join(root, "supabase/migrations/20261014202700_review_ready_notifications_forward.sql"), "utf8");
const buyer = "11111111-1111-4111-8111-111111111111";
const seller = "22222222-2222-4222-8222-222222222222";
const order = "33333333-3333-4333-8333-333333333333";
const item = "44444444-4444-4444-8444-444444444444";
const sellerId = "55555555-5555-4555-8555-555555555555";
const part = "66666666-6666-4666-8666-666666666666";

test("review-ready SQL replays safely and notifies once per participant only after eligibility", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema private;
      create table public.orders(id uuid primary key,buyer_id uuid not null);
      create table public.sellers(id uuid primary key,owner_id uuid not null);
      create table public.parts(id uuid primary key,title text not null);
      create table public.order_items(
        id uuid primary key,order_id uuid not null,seller_id uuid not null,part_id uuid not null,
        payout_status text not null,funds_released_at timestamptz,fulfilment_status text not null
      );
      create table public.notifications(
        id bigint generated always as identity primary key,profile_id uuid not null,type text not null,
        title text not null,body text,href text,dedupe_key text not null,
        unique(profile_id,dedupe_key)
      );
    `);
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(`
      insert into public.orders values ('${order}','${buyer}');
      insert into public.sellers values ('${sellerId}','${seller}');
      insert into public.parts values ('${part}','Used alternator');
      insert into public.order_items values ('${item}','${order}','${sellerId}','${part}','scheduled',null,'preparing');
      update public.order_items set fulfilment_status='completed' where id='${item}';
    `);
    let rows = (await db.query("select profile_id,dedupe_key from public.notifications")).rows;
    assert.equal(rows.length, 0);

    await db.exec(`update public.order_items set payout_status='released',funds_released_at=now() where id='${item}'`);
    rows = (await db.query("select profile_id,dedupe_key,type,href from public.notifications order by profile_id")).rows;
    assert.deepEqual(rows, [
      { profile_id: buyer, dedupe_key: `review-ready:${item}:buyer`, type: "account", href: "/account/reviews" },
      { profile_id: seller, dedupe_key: `review-ready:${item}:seller`, type: "account", href: "/account/reviews" },
    ]);

    await db.exec(`update public.order_items set fulfilment_status='completed' where id='${item}'`);
    await db.exec(`update public.order_items set payout_status='scheduled' where id='${item}'`);
    await db.exec(`update public.order_items set payout_status='released' where id='${item}'`);
    const count = (await db.query("select count(*)::integer as count from public.notifications")).rows[0].count;
    assert.equal(count, 2);
  } finally {
    await db.close();
  }
});
