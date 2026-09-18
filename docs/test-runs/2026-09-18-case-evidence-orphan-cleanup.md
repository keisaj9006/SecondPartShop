# Case evidence orphan cleanup outbox — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint hardens the failure path where a case-evidence Storage upload succeeds but the database evidence registration fails. It does not alter case eligibility, evidence visibility, Stripe, Buyer Protection, Production or `main`.

## Root cause

Web and mobile evidence upload previously used this sequence:

1. upload the object to the private `case-evidence` bucket;
2. call `register_transaction_case_evidence`;
3. if registration failed, call Storage `remove` once;
4. ignore the cleanup result and return the registration error.

If the Storage removal failed or its outcome was uncertain, there was no durable retry authority. The result could be an unregistered orphan object that remained in the private bucket until some later manual/privacy cleanup.

## Design

The repair follows the existing secure part-image cleanup pattern but keeps a separate authorization boundary for case evidence.

Source migration:

- `supabase/migrations/20260918154500_case_evidence_cleanup_outbox.sql`
- private table `private.case_evidence_cleanup`;
- no foreign keys, so pending cleanup survives later case/profile deletion;
- service-only RPCs:
  - `queue_orphan_case_evidence_cleanup`;
  - `get_case_evidence_cleanup_queue`;
  - `complete_case_evidence_cleanup`;
  - `fail_case_evidence_cleanup`.

The queue RPC independently verifies that the supplied uploader is the transaction buyer or seller owner for the case. It also validates the exact server-generated `case/uploader/uuid.ext` path and refuses cleanup authority when a `transaction_case_evidence` row already owns that path.

Application helper:

- `src/lib/case-evidence-cleanup.ts`;
- validates the exact path again before any fallback deletion;
- queues durable intent before Storage removal when the RPC is available;
- retries queued cleanup through the maintenance worker;
- leaves failed Storage cleanup pending with a five-minute retry window;
- records bounded operational warnings without exposing storage paths.

## Safe staged rollout

The Preview code is intentionally backward-compatible before the migration is deployed.

If PostgREST returns `PGRST202` / undefined-function for the new cleanup RPC, the helper preserves the pre-migration exact-path removal only for the server-generated path from the current upload attempt. Invalid/arbitrary paths are never removed.

The maintenance worker treats the missing cleanup RPC as `skipped:true` rather than failing the whole commerce-maintenance request. Any other queue/schema error remains a real error.

Therefore code can be deployed before the database migration without disabling evidence upload. Durable retry becomes active once the reviewed migration is explicitly deployed.

## TDD RED

RED commit:

- `672630c59cd81626ae85ac7c0638177dd9482a1e`
- GitHub Actions run: `35358590404`

Observed RED:

- 614 tests total;
- 604 PASS;
- 10 expected failures across the missing migration/helper, old direct-remove integration and missing maintenance worker.

## GREEN implementation

Main implementation commits include:

- `b33f7977a5da433fecdebe007e8e78f08b7ba524` — source migration;
- `73d6ef42cea34c378f6d2872d82dc2eac2506b10` — cleanup helper/worker;
- `d25303940c598f2e0c324a24cd3e8fc15e09a313` — web integration;
- `343b6eecbc7f204479206ed9a83431cb7d528254` — mobile integration;
- `202568cb78edb72ab38abfc19a6f75b814f767d1` — maintenance retry worker.

The first GREEN run exposed two test-harness assumptions rather than product defects:

- the migration test expected a direct `o.buyer_id` comparison although the SQL correctly compared the loaded `participant.buyer_id`;
- the previous mobile signed-URL harness did not stub the newly imported cleanup helper.

Those harnesses were aligned without weakening application or SQL behavior.

Final application/test SHA:

- `6159916e6eda8ce6ab9c726377f51b51255a784b`

## Final verification

GitHub Actions run `35359425939`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- tests: **614/614 PASS**, 0 FAIL;
- lint: 0 errors;
- typecheck: PASS;
- commerce/release validators: PASS;
- production Next.js build: PASS; compiled successfully.

Vercel Preview:

- deployment: `dpl_CagJASFvVzYYB8BqEynzUapuBPaz`;
- exact URL: `https://second-part-shop-pvf1yogj8-joannakwapis11-5369.vercel.app`;
- stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Fresh read-only health smoke on exact deployment and branch alias returned HTTP 200 with `backendReady:true`.

## Remaining boundary

The migration is source-controlled but has **not** been applied to the connected `secondpart` Supabase project in this checkpoint.

Until explicit hosted deployment/readback:

- normal evidence upload remains functional through the staged compatibility path;
- direct cleanup remains the fallback when the new RPC is absent;
- the durable outbox/retry semantics are not yet claimed as active on the hosted project.

Hosted sign-off requires an explicitly authorised migration deployment followed by privilege/schema readback. No production/shared database mutation was performed by this checkpoint.
