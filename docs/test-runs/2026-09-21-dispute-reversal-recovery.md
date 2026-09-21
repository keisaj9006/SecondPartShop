# Provider dispute reversal recovery — 21 September 2026

## Scope and implementation

Continuation on the current `rebuild-nextjs` source (`1a2f447` base), in the existing isolated handover worktree. This extends the application terminal guard, without changing the payment model, buyer-protection window or seller fees.

The old worker could submit another transfer reversal after a lost provider response or database finalization error. Provider idempotency alone was not durable authority: Stripe may prune keys after at least 24 hours. See [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests). SQL also accepted contradictory terminal outcomes and opening a dispute overwrote an in-flight payout's `releasing` marker.

The new flow:

1. The worker checks the case and acquires a service-only database claim, serialized with close through order → item → case row locks.
2. Only the first committed claim may authorize a reversal POST. The claim never expires and is never deleted/reset to permit a retry.
3. The request carries a non-personal `secondpart_dispute_id` metadata correlation. The existing Stripe API version and request idempotency key are retained.
4. A retry with a known reversal ID reads that exact provider object. A retry without an ID performs a bounded transfer-reversals read and requires exactly one correlated result, matching transfer, amount and GBP currency.
5. Empty, partial (`has_more`), duplicate, mismatched or unavailable evidence does not permit another POST or finalization.
6. The evidence is recorded by a service-only RPC before SQL close. A failed record/close remains recoverable by a later signed webhook replay and read-only provider lookup.
7. SQL independently rejects conflicting terminal outcomes, unrecorded reversal evidence, unresolved payout work and a won outcome after a reversal claim. Open preserves in-flight payout state.

The provider fields used for verification are documented in [the reversal object](https://docs.stripe.com/api/transfer_reversals/object). No full provider response, key, buyer identity or card data is logged by this change.

## Files changed

- Worker and provider adapter: `src/lib/commerce-provider-disputes.ts`, `src/lib/stripe-payments.ts`.
- RPC type extension: `src/lib/supabase/runtime-admin.types.ts`.
- Database: the new recovery migration listed below.
- Regression coverage: `scripts/test-dispute-reversal-recovery.mjs`, `scripts/test-dispute-reversal-recovery-sql.mjs`, `scripts/lib/dispute-recovery-fixture.mjs`, updated terminal-guard and Stripe-adapter tests.
- True concurrency harness: `scripts/verify-dispute-reversal-concurrency-postgres.mjs` and `.github/workflows/rebuild-nextjs-qa.yml`.
- Documentation: this report, handover audit and launch-readiness link.

## Migration and rollout

Migration: `supabase/migrations/20260921075633_provider_dispute_reversal_recovery.sql`, generated with Supabase CLI. It adds private durable evidence, two service-only RPCs, and revised dispute open/close functions. The private table has RLS and no direct user/service-role grants; only the narrowly granted SECURITY DEFINER RPCs access it, with empty search paths.

**Local only. No hosted migration or application deployment is claimed.** Deploy this migration before the application caller; the application fails closed when the claim RPC is absent, rather than falling back to the unsafe old POST path.

Deployment must inspect the connected project's migration history and read current function definitions first. Use a controlled window which drains old webhook workers: running the old worker concurrently with the new migration could still send unclaimed reversals. Do not roll application code back to the old unclaimed reversal implementation after activation.

The backfill creates non-reusable claims for existing disputes with released transfers (excluding already won/warning-closed outcomes). This is deliberately conservative: an absent local reversal ID cannot prove that an old worker never sent the request. Consequently an existing active dispute later reported as won can also be held for manual reconciliation. This is a real operational tradeoff, not an automatic recovery claim.

Before activation, inventory these legacy cases read-only. For each, inspect the transfer and reversal evidence at Stripe, the exact amount/currency, original dispute events and local history. Preserve saved legacy IDs; do not invent metadata, erase a claim, reset a terminal outcome or infer success from the absence of a list result. An untagged legacy reversal or a quarantined won outcome needs a separately reviewed, audited resolution based on actual provider evidence. The current patch does not introduce an admin override button.

For new correlated claims, replay the original signed Stripe event after a temporary failure. If provider evidence is complete, this executes only GET/record/finalize on retry. If Stripe has stopped automatic delivery, use its normal event replay mechanism. Existing webhook critical-error monitoring reports failed processing; no additional notification destination was configured. Unknown outcomes remain blocked until reconciled.

Post-deployment checks: private-table RLS, direct grants denied, RPC execution denied to anon/authenticated and allowed to service_role, deployed function definitions and migration identity; then controlled sandbox lost-response/replay evidence. These checks were not executed against the hosted project in this batch.

## Verification evidence

TDD reproduced:
- eight initial application failures, including two reversal POSTs on lost-response retry and overlapping calls;
- SQL failures for contradictory/unsupported terminal outcomes, unrecorded evidence and missing durable claims;
- an in-flight payout changing from `releasing` to `blocked` when its dispute opened;
- missing metadata on the reversal request;
- a reversed payout without its reversal ID incorrectly authorizing a new mutation.

Focused checks passed after the fix:
- 14 worker tests covering lost response, failed persistence/finalization, overlapping callers, wrong amount/currency/transfer/correlation, incomplete/duplicate evidence, unavailable claim and mismatched stored ID;
- 13 SQL tests, including rollout quarantine, privileges, terminal immutability, one-shot claims and missing reversal evidence (27/27 with the worker suite);
- existing terminal-guard and adapter checks.

A syntax error in the generated open-function dollar quotes was caught by independent review and actual SQL execution, fixed, and the SQL suite rerun successfully.

### Actual PostgreSQL concurrency

Executed `scripts/verify-dispute-reversal-concurrency-postgres.mjs` on disposable local **PostgreSQL 17.10**, with three independent connections. Each competing operation was observed waiting on a PostgreSQL lock before the winner committed:

- competing claims: one `claimed=true`, the other `false`;
- claim commits first: won close rejected;
- won close commits first: reversal claim rejected.

All three PASS. The temporary server bound only to `127.0.0.1:55439` and was stopped after the proof. No shared Supabase data or provider operation was involved. The script refuses a non-local URL or any database name other than `secondpart_dispute_rc`, and refuses nonempty databases. It performs no reset/drop.

The same harness is added as `dispute-reversal-concurrency` in GitHub Actions, using an isolated PostgreSQL 17 service. The new CI job has not yet run remotely.

## Limits and next gate

This proof establishes database serialization and application retry behaviour. It is not a fresh real Stripe E2E, hosted migration sign-off or release-readiness claim. The claim protocol covers this dispute worker; provider-side manual operations and other financial workflows still need their own evidence and operational controls.

Final independent read-only review confirmed the missing-evidence guard and found no remaining critical/important findings in scope.

Integrated checks: all 14 static validators PASS; lint PASS with four pre-existing warnings; typecheck PASS. Production build PASS (exit 0) using CI-style placeholder configuration. Full suite: **655/655 PASS**, zero failures/skips; `git diff --check`: PASS. No hosted mutation, commit, push or deployment was performed.

Recommended next task: review and integrate this patch against current `rebuild-nextjs`, then inspect hosted legacy dispute evidence and arrange the controlled migration/application rollout before a fresh sandbox lost-response/replay proof. Preserve the unrelated old dirty checkout.
