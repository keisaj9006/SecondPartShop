import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n");
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const approvedPath = "docs/test-runs/2026-10-08-deletion-checkout-guard.sql";
const adoptedPath = "supabase/migrations/20261008130523_account_deletion_checkout_fitting_serialization.sql";
const historicalReviewPath = "supabase/migrations/20260906225000_review_ready_notifications.sql";
const forwardReviewPath = "supabase/migrations/20261014202700_review_ready_notifications_forward.sql";

test("five-function source is the exact approved artifact without its transport transaction", () => {
  const approved = read(approvedPath);
  // Pin the canonical LF source so Windows CRLF checkout conversion cannot make CI and local disagree.
  assert.equal(sha256(approved), "b36e7abd25851a8bab46e4d33d2dc963beaca7e03e5584ec922ab8b4e5c8efd5");
  assert.equal((approved.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((approved.match(/^commit;$/gm) ?? []).length, 1);
  const expected = approved.replace("\nbegin;\n", "\n").replace(/\ncommit;\s*$/i, "\n");
  const adopted = read(adoptedPath);
  assert.equal(adopted.trimEnd(), expected.trimEnd());
  assert.equal(sha256(adopted), "b27f06d1d4d787827d2c476c25da22748d2b53d17e8097919e41ce718722b934");
});

test("five-function source pins signatures, definer search paths and execute roles", () => {
  const source = read(adoptedPath);
  const functions = [
    ["prepare_checkout_order", "uuid,integer,text", "authenticated,service_role"],
    ["claim_account_deletion_request", "uuid", "service_role"],
    ["request_part_fitting_quote", "uuid,uuid,uuid,smallint,text,integer,text,text", "authenticated,service_role"],
    ["garage_respond_fitting_request", "uuid,text,integer,text", "authenticated,service_role"],
    ["send_fitting_request_message", "uuid,text", "authenticated,service_role"],
  ];
  assert.equal((source.match(/create or replace function public\./g) ?? []).length, functions.length);
  assert.equal((source.match(/security definer/g) ?? []).length, functions.length);
  assert.equal((source.match(/set search_path=''/g) ?? []).length, functions.length);
  for (const [name, args, roles] of functions) {
    assert.match(source, new RegExp(`create or replace function public\\.${name}\\(`));
    assert.ok(source.includes(`revoke all on function public.${name}(${args}) from public,anon,authenticated,service_role;`));
    assert.ok(source.includes(`grant execute on function public.${name}(${args}) to ${roles};`));
  }
});

test("forward review notification preserves the historical evidence but hardens current eligibility", () => {
  const historical = read(historicalReviewPath);
  const forward = read(forwardReviewPath);
  assert.notEqual(forward, historical);
  assert.match(historical, /new\.payout_status='released'/);
  assert.match(forward, /create or replace function private\.notify_transaction_review_ready\(\)/);
  assert.match(forward, /o\.payment_status='paid'/);
  assert.match(forward, /oi\.refunded_at is null/);
  assert.match(forward, /c\.status in \('open','seller_response','under_review','return_authorized','return_shipped','returned'\)/);
  assert.match(forward, /'review-ready:'\|\|review_item_id::text\|\|':buyer'/);
  assert.match(forward, /'review-ready:'\|\|review_item_id::text\|\|':seller'/);
  assert.equal((forward.match(/on conflict do nothing/g) ?? []).length, 2);
  assert.match(forward, /drop trigger if exists transaction_review_ready_notification on public\.order_items;/);
  assert.match(forward, /after update of payout_status,funds_released_at,fulfilment_status,refunded_at on public\.order_items/);
  assert.match(forward, /drop trigger if exists transaction_case_review_ready_notification on public\.transaction_cases;/);
  assert.match(forward, /after update of status on public\.transaction_cases/);
  assert.match(forward, /revoke all on function private\.notify_transaction_review_ready\(\) from public;/);
});

test("new migration identities are unique without rewriting historical identities", () => {
  const names = readdirSync(path.join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"));
  for (const target of [path.basename(adoptedPath), path.basename(forwardReviewPath)]) {
    assert.equal(names.filter((name) => name === target).length, 1);
    const version = target.slice(0, 14);
    assert.equal(names.filter((name) => name.startsWith(version + "_")).length, 1);
  }
  const byVersion = Map.groupBy(names, (name) => name.slice(0, 14));
  assert.deepEqual(
    [...byVersion].filter(([, files]) => files.length > 1).map(([version]) => version).sort(),
    ["20260906282000", "20260906282500", "20260907123500", "20260907125000"],
  );
  assert.equal(names.filter((name) => name.endsWith("_invalidate_verification_on_seller_identity_change.sql")).length, 2);
});

test("RC-03 classifies every unresolved RC-02 row exactly once", () => {
  const csv = read("docs/test-runs/2026-10-14-rc03-26-classification.csv").trim().split("\n");
  assert.equal(csv.length, 27);
  assert.equal(csv.filter((row) => row.includes('"SEMANTIC_MATCH"')).length, 22);
  assert.equal(csv.filter((row) => row.includes('"SUPERSEDED"')).length, 4);
  const sourceNames = csv.slice(1).map((row) => row.split('\",\"')[2]);
  assert.equal(new Set(sourceNames).size, 26);
});
