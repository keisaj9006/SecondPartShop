import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildManifest } from "./rc04-disposable-replay.mjs";

test("RC-04 manifest preserves all local source once and orders four duplicate identities by hosted history", () => {
  const manifest = buildManifest();
  assert.equal(manifest.length, 207);
  const files = manifest.flatMap((entry) => entry.files);
  assert.equal(new Set(files).size, 208); // Two local files form one hosted atomic statement.
  assert.equal(files.filter((file) => file.includes("review_ready_notifications.sql")).length, 0);
  assert.equal(files.filter((file) => file.includes("docs/test-runs/2026-10-08-deletion-checkout-guard.sql")).length, 0);
  assert.equal(files.filter((file) => file.includes("20261008130523_account_deletion_checkout_fitting_serialization")).length, 1);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const expected = readdirSync(path.join(root, "supabase/migrations")).filter((file) => file.endsWith(".sql") && !file.endsWith("_review_ready_notifications.sql") && !file.endsWith("_review_ready_notifications_forward.sql"));
  assert.deepEqual(new Set(files.map((file) => path.basename(file))), new Set(expected));
  const position = (fragment) => manifest.findIndex((entry) => entry.files.some((file) => file.includes(fragment)));
  for (const [first, second] of [
    ["targeted_part_request_routing", "ranked_find_my_part_leads"],
    ["targeted_request_notifications", "buyer_request_match_counts"],
    ["vehicle_lookup_operational_guard", "saved_search_match_queue"],
    ["catalogue_sorted_marketplace_page", "saved_search_feed_index"],
    ["20260906223000_invalidate_verification", "20260907175000_invalidate_verification"],
  ]) assert.ok(position(first) >= 0 && position(first) < position(second), `${first} must precede ${second}`);
  const combined = manifest.find((entry) => entry.hosted_version === "20260921133420");
  assert.equal(combined.files.length, 2);
  assert.match(combined.files[0], /outbox/);
  assert.match(combined.files[1], /registration_guard/);
  const hostedSearchSource = readFileSync(path.join(root, "supabase/migrations/20260905094854_marketplace_search_ranking.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(createHash("md5").update(hostedSearchSource).digest("hex"), "2b4b9a938124cfdb88d305cd0f739cef");
});
