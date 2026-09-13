# RC hardening — last-stock concurrency, deletion minimization, authorization and notification evidence

Date: 2026-09-13

Scope: `rebuild-nextjs`, isolated CI PostgreSQL 17 and SecondPart QA/Preview only. No `main`, Production, live Stripe money movement, real account deletion, real email delivery or real FCM delivery was executed.

## RC-P0 — last-stock concurrency

A dedicated GitHub Actions job now runs the canonical `prepare_checkout_order` function extracted from `supabase/migrations/20260906163000_checkout_reservation_lifecycle.sql` against an ephemeral PostgreSQL 17 service container.

The harness opens two independent `psql` sessions against a single listing with stock `1`. Buyer A obtains the listing row lock and holds the transaction open. Buyer B starts while Buyer A still owns the lock. After Buyer A commits, Buyer B resumes against the newly committed row state and fails closed because the listing is no longer available.

Observed successful result:

```json
{"stock":0,"status":"reserved","orders":1,"items":1,"reservation_events":1,"buyer_a_orders":1,"buyer_b_orders":0}
```

Evidence:

- workflow run `34753804806` — SUCCESS;
- `last-stock-concurrency` job — SUCCESS;
- standard `validate` job — SUCCESS;
- the concurrency job uses PostgreSQL 17 and two separate connections, not PGlite or a single transaction;
- full standard gates also pass: lint, typecheck, full `npm test`, all configured validators and production build;
- branch SHA at this checkpoint: `dca103b17a7358ccaed6bcc207592cad3c903950`;
- Vercel deployment `dpl_DsUhRwTMrmruj1p2PzdWFAcehVqq` is READY for that SHA;
- current branch alias: `second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`.

The manual alias `second-part-shop-preview.vercel.app` remains stale and was observed resolving to older SHA `66b94bf6d1c9b160dacf9e312925a9c1cd2d3c6c`. It is not current QA evidence.

## RC-P0 — account deletion minimization deployment

Source migration:

- `supabase/migrations/20260912215057_account_deletion_seller_minimization.sql`

QA deployment:

- Supabase project `secondpart` (`etkupijfdznljimrfyct`);
- remote migration `20260913111341 / account_deletion_seller_minimization`.

Pre-deployment read-only checks showed `0` deletion requests and `0` processing deletion requests. Applying the migration therefore replaced only the function definition; no deletion workflow was invoked.

Post-deployment readback confirms:

- `prepare_claimed_account_deletion(uuid,uuid)` — anon execute `false`;
- authenticated execute `false`;
- service role execute `true`;
- deployed function scrubs private-seller display names to a deletion tombstone;
- donor registration and donor notes are scrubbed;
- inventory import filename and row-level error summary are scrubbed;
- seller public slug/location/geodata and garage public identity/location fields are tombstoned/suspended according to the reviewed migration;
- deletion request count remained `0`.

The isolated SQL regression in `scripts/test-account-deletion-minimization.mjs` remains part of the normal `npm test` suite and passed in workflow `34753804806`.

A real destructive account-deletion E2E remains **UNSIGNED** because no disposable QA account was actually deleted. Final legal-retention wording/identity decisions also remain external launch work.

## RC-P0 — deployed role / authorization negative probes

A transaction-scoped QA probe used a synthetic authenticated principal that is not the buyer, seller or admin for existing fixture records. Every mutating probe was isolated with savepoints/rollback so no durable business-state mutation was retained.

Observed negative boundaries — **9/9 blocked**:

1. non-admin cannot run admin payout review;
2. non-buyer cannot open a transaction case on another buyer's item;
3. non-buyer cannot mark another buyer's item received;
4. non-participant cannot send a transaction message;
5. non-seller cannot update another seller's fulfilment;
6. RLS prevents updating another seller's listing;
7. RLS hides another buyer's order;
8. RLS hides another buyer's order item;
9. RLS hides another seller's payment account.

Deployed table review also confirms RLS is enabled for the private commerce surfaces inspected (`orders`, `order_items`, `transaction_cases`, `transaction_messages`, `seller_payment_accounts`, notifications and related private tables). Public child listing tables such as part images/fitments restrict anonymous reads to active listings.

A broader public-data-contract issue remains P1: the `sellers` row itself is publicly readable for non-deleted sellers, so any field that must not be public requires an explicit database/API projection contract rather than UI hiding alone.

## RC-P0 — Storage/private evidence readback

- `storage.objects` has RLS enabled;
- `case-evidence` bucket is private;
- `case-evidence` permits participant-authorized read/upload only;
- `case-evidence` size limit is 5 MiB and MIME allowlist is JPEG/PNG/WebP;
- `part-images` is intentionally public for marketplace listing media;
- client update/delete for `part-images` is blocked; uploads use the guarded owner path policy.

There were no current `case-evidence` objects, so an actual private-object read by participant versus non-participant was not available to execute. That specific live-object check remains unsigned.

## RC-P0 — critical notification state

QA aggregate readback showed in-app lifecycle notifications already present for:

- `order_paid`;
- `order_dispatched`;
- `order_received`;
- `order_accepted`;
- `order_update`.

At the same checkpoint:

- pending/retry push outbox rows: `0`;
- enabled push devices: `0`;
- no stale push backlog existed.

This proves in-app notification persistence and no current queue backlog. It does **not** prove real FCM delivery because no QA device token was enabled. Physical-device FCM receipt remains an external/manual gate.

## Release implication

The last-stock two-buyer race is now verified with a real two-connection PostgreSQL 17 test and is no longer an unsigned P0. The reviewed deletion-minimization function is installed in QA with service-role-only execution and no deletion invocation. Core deployed buyer/seller/admin negative authorization boundaries tested here are also verified.

Closed Beta is still not automatically READY. Remaining external/provider/manual P0 evidence includes Stripe adverse-flow E2E (decline/retry, real refund/reversal/dispute webhook delivery/replay), physical Android/FCM/deep-link/upload checks, a disposable destructive account-deletion E2E if required for the beta scope, and any unresolved operational/legal launch prerequisites.
