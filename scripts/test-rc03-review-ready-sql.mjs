import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(path.join(root, "supabase/migrations/20261014202700_review_ready_notifications_forward.sql"), "utf8");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const buyer = id(1), seller = id(2), sellerId = id(3), part = id(4), paidOrder = id(5), unpaidOrder = id(6);

test("review-ready SQL matches current verified-review eligibility and case closure semantics", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema private;
      create table public.orders(id uuid primary key,buyer_id uuid not null,payment_status text not null);
      create table public.sellers(id uuid primary key,owner_id uuid not null);
      create table public.parts(id uuid primary key,title text not null);
      create table public.order_items(
        id uuid primary key,order_id uuid not null,seller_id uuid not null,part_id uuid not null,
        payout_status text not null,funds_released_at timestamptz,fulfilment_status text not null,refunded_at timestamptz
      );
      create table public.transaction_cases(id uuid primary key,order_item_id uuid not null,status text not null);
      create table public.notifications(
        id bigint generated always as identity primary key,profile_id uuid not null,type text not null,
        title text not null,body text,href text,dedupe_key text not null,unique(profile_id,dedupe_key)
      );
      insert into public.orders values ('${paidOrder}','${buyer}','paid'),('${unpaidOrder}','${buyer}','unpaid');
      insert into public.sellers values ('${sellerId}','${seller}');
      insert into public.parts values ('${part}','Used alternator');
    `);
    await db.exec(migration);
    await db.exec(migration);

    const eligible = id(10), unpaid = id(11), refunded = id(12), cancelled = id(13), activeCase = id(14), alreadyEligible = id(15);
    await db.exec(`
      insert into public.order_items values
        ('${eligible}','${paidOrder}','${sellerId}','${part}','scheduled',null,'completed',null),
        ('${unpaid}','${unpaidOrder}','${sellerId}','${part}','scheduled',null,'completed',null),
        ('${refunded}','${paidOrder}','${sellerId}','${part}','scheduled',null,'completed',now()),
        ('${cancelled}','${paidOrder}','${sellerId}','${part}','scheduled',null,'cancelled',null),
        ('${activeCase}','${paidOrder}','${sellerId}','${part}','scheduled',null,'completed',null),
        ('${alreadyEligible}','${paidOrder}','${sellerId}','${part}','released',now(),'completed',null);
      insert into public.transaction_cases values ('${id(20)}','${activeCase}','open');
      update public.order_items set payout_status='released',funds_released_at=now()
        where id in ('${eligible}','${unpaid}','${refunded}','${cancelled}','${activeCase}');
      update public.order_items set payout_status='released' where id='${alreadyEligible}';
    `);

    let rows = (await db.query("select profile_id,dedupe_key,type,href from public.notifications order by profile_id")).rows;
    assert.deepEqual(rows, [
      { profile_id: buyer, dedupe_key: `review-ready:${eligible}:buyer`, type: "account", href: "/account/reviews" },
      { profile_id: seller, dedupe_key: `review-ready:${eligible}:seller`, type: "account", href: "/account/reviews" },
    ]);

    await db.exec(`update public.transaction_cases set status='resolved' where id='${id(20)}'`);
    rows = (await db.query(`select profile_id,dedupe_key from public.notifications where dedupe_key like 'review-ready:${activeCase}:%' order by profile_id`)).rows;
    assert.deepEqual(rows, [
      { profile_id: buyer, dedupe_key: `review-ready:${activeCase}:buyer` },
      { profile_id: seller, dedupe_key: `review-ready:${activeCase}:seller` },
    ]);

    await db.exec(`
      update public.transaction_cases set status='closed' where id='${id(20)}';
      update public.order_items set payout_status='scheduled' where id='${eligible}';
      update public.order_items set payout_status='released' where id='${eligible}';
    `);
    assert.equal((await db.query("select count(*)::integer count from public.notifications")).rows[0].count, 4);
  } finally {
    await db.close();
  }
});
