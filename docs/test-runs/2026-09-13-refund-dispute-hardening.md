# RC hardening — refund authority and dispute ordering

Date: 2026-09-13

Scope: `rebuild-nextjs`, Preview/QA only. No `main`, Production, live Stripe money movement, real refunds, real reversals, or real disputes were executed.

## RC-P0-03 — refund authority

### Defect reproduced

The previous `src/lib/commerce-refunds.ts` treated every non-throwing Stripe refund response as final and immediately called `finalize_transaction_case_refund`, regardless of provider refund status. It also did not require the database finalizer to return `true` and had no authoritative retry lookup for a previously correlated refund.

### Repair

- Added authoritative `GET /v1/refunds/:id` support in `src/lib/stripe-payments.ts`.
- Persist provider refund correlation before local finalization.
- Reuse the correlated provider refund on retry rather than POSTing another refund.
- Treat `pending` and `requires_action` as retryable, unresolved states.
- Treat `failed` and `canceled` as unsuccessful, unresolved states.
- Refuse to finalize unknown/unverified statuses.
- Finalize only `succeeded` refunds.
- Require the database finalizer to acknowledge durable completion with Boolean `true`.
- Persist a seller-transfer reversal before continuing so a retry cannot reverse the transfer twice.
- Preserve stable idempotency keys for provider refund and reversal operations.

### Regression coverage

`scripts/test-commerce-refunds.mjs` covers:

1. pending refund correlation without case finalization;
2. `requires_action` without finalization;
3. failed/canceled refunds without finalization;
4. successful refund finalization exactly once;
5. retry of correlated pending refund without a second POST;
6. database finalization error with provider-safe retry;
7. false database finalization acknowledgement with provider-safe retry;
8. released seller payout reversed once before successful refund;
9. pending refund after payout reversal without duplicate reversal/refund.

The first RED run was intentional. A later failing run exposed a test-fixture defect (`orders.id` missing from the mock), not a production regression; the fixture was corrected before final verification.

### Verification

- Code-level GREEN SHA: `998b0b7821a2b3a8cf054a128c4c851b643d4214`.
- GitHub Actions run: `34751571374` — SUCCESS.
- Successful gates: diff check, lint, typecheck, full `npm test`, all configured validators, production build.
- Vercel Preview for the later integrated branch remains READY, so this code is included in the current branch Preview.

Provider Stripe test-mode E2E is still **UNSIGNED**. Green unit/integration CI does not prove an actual provider refund/reversal outcome.

## RC-P0-04 — provider dispute event ordering

### Defect reproduced on actual SQL

`scripts/test-provider-dispute-ordering.mjs` applies the real dispute migrations to an isolated PGlite PostgreSQL schema. RED run `34751702420` reproduced all required failure modes:

1. `charge.dispute.created` arriving before order/payment linkage consumed its event ID instead of remaining retryable;
2. `charge.dispute.closed` arriving before the provider case existed consumed its event ID instead of remaining retryable;
3. duplicate close delivery returned `false` after the first durable close instead of acknowledging the replay;
4. a late provider dispute during an active return attempted a second active case and failed with PostgreSQL `23505` on `transaction_cases_one_open_per_item`.

### Repair

Migration source: `supabase/migrations/20260913102500_provider_dispute_event_ordering.sql`.

- Event IDs are consumed only after the corresponding durable order/case transition succeeds.
- Missing order/case linkage raises an error before event consumption, allowing the existing webhook route to return non-2xx and the provider to retry.
- Existing provider cases acknowledge duplicate deliveries without duplicating semantic case/order events.
- Historical consume-before-link event rows can be recovered because an existing `payment_events` row no longer prevents the durable outcome from being applied.
- Active return states `return_authorized`, `return_shipped`, and `returned` are included in the existing-case lookup, preserving the single-active-case invariant.
- A provider dispute reuses the active transaction case and moves it under provider review rather than inserting a conflicting active case.
- Service-role-only execution remains enforced for both provider dispute RPCs.

### Verification

- GREEN SHA: `b2612a2948436933ea50b5093ba2ec0776371288`.
- GitHub Actions run: `34751809352` — SUCCESS.
- Successful gates: diff check, lint, typecheck, full `npm test`, all configured validators, production build.
- Vercel deployment: `dpl_86yuqfNm2GiTKCmZ5rfZDyGUV2YP` — READY, exact SHA `b2612a2948436933ea50b5093ba2ec0776371288`.
- Current branch alias points at that deployment: `second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`.
- The manually maintained alias `second-part-shop-preview.vercel.app` was observed still pointing to older SHA `66b94bf6d1c9b160dacf9e312925a9c1cd2d3c6c`; it is not treated as current evidence.

### QA Supabase deployment

Applied to project `secondpart` (`etkupijfdznljimrfyct`) as remote migration:

- `20260913102817 / provider_dispute_event_ordering`

Read-only post-deployment checks confirmed:

- `open_provider_payment_dispute`: anon `false`, authenticated `false`, service_role `true`;
- `close_provider_payment_dispute`: anon `false`, authenticated `false`, service_role `true`;
- deployed open definition contains the missing-order retry guard and late-return state handling;
- deployed close definition contains the missing-case retry guard;
- current QA aggregate: 0 dispute-open events, 0 dispute-close events, 0 orphan dispute events.

No dispute RPC was invoked against QA data during deployment verification.

Provider Stripe webhook delivery/replay E2E is still **UNSIGNED**. The isolated SQL proof and deployed function-definition checks do not substitute for a real Stripe test-mode delivery sequence.

## Remaining release implication

These two confirmed P0 implementation defects are repaired and regression-protected at code/SQL level. Closed Beta is still **NOT READY** solely on the basis of these greens; the remaining RC P0 evidence includes provider adverse-flow E2E, last-stock concurrency, decline/retry/expiry, delayed/out-of-order provider delivery, remaining authorization/RLS boundaries, critical notification delivery, privacy/deletion external/destructive gates, and physical Android release gates.
