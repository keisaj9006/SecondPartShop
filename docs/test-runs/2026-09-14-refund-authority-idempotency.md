# SecondPart P0 refund authority and idempotency — 2026-09-14

This checkpoint records the refund/reversal hardening verified on `rebuild-nextjs`. It separates code/CI/Preview evidence from provider-level mutation evidence. No Stripe refund, transfer reversal, case creation, payout mutation or destructive database operation was executed while producing this checkpoint.

## Final verified code boundary

- Final application SHA: `f1577d1a8594c60aeba6b9399100a7c41e97451b` — `payments: reject reversal correlation conflicts`
- GitHub Actions run: `34870879224` (`rebuild-nextjs QA`, run 1887)
- `validate`: PASS
  - `git diff --check HEAD^ HEAD`: PASS
  - lint: PASS
  - typecheck: PASS
  - full `npm test`: PASS
  - all 14 release validators: PASS
  - production build: PASS
- `last-stock-concurrency`: PASS
- `marketplace-scale-postgres`: PASS, including the isolated 100k search proof and single-scan verification
- Exact-SHA Vercel Preview: `dpl_EfLDoVr36yRjhaD79Mzey8ACFaoQ` — READY
- Preview branch alias: `second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`
- Deployment metadata reports `githubCommitRef=rebuild-nextjs` and `githubCommitSha=f1577d1a8594c60aeba6b9399100a7c41e97451b`.

This proves the implemented code boundary and deployment alignment. It does not by itself prove a real Stripe refund/reversal lifecycle through the authenticated Preview UI.

## Baseline provider/database fixture — read-only

The existing successful Stripe sandbox happy-path fixture was inspected without mutation:

- order: `d53fc4eb-9830-4956-8e6f-2ced3ea37a72`
- order item: `24fcf358-dba3-4278-9740-79eaa89f0681`
- PaymentIntent: `pi_3UEaav2RWsyIBCbK1Z4TppDc`
- seller transfer: `tr_3UEaav2RWsyIBCbK1ZxP18jl`
- Stripe platform sandbox account: `acct_1UEUN72RWsyIBCbK`
- `livemode=false`

Post-hardening readback:

- Stripe `GET /v1/refunds?payment_intent=pi_3UEaav2RWsyIBCbK1Z4TppDc`: 0 refunds
- order remains `paid / completed`
- item remains fulfilment `completed`
- payout remains `released`
- `provider_transfer_reversal_id`: null
- `refunded_at`: null
- no transaction case exists for the fixture
- no `provider_refund_id` exists

The known successful transaction therefore remains intact and reusable as historical happy-path evidence.

## Defect A — successful refund response was insufficiently authenticated against local intent

### Root cause

`refundTransactionCase` correctly required Stripe refund status `succeeded`, but a successful-looking provider object was not cross-checked against the operation SecondPart intended to perform. A mismatched refund object could therefore have been treated as authority to finalize the local full refund.

The missing provider-identity checks were:

- exact expected refund amount
- GBP currency
- exact order PaymentIntent

### RED proof

Commit `3cc3d7fd3a58454d018733437478d89ff50ada70` added `scripts/test-refund-provider-authority.mjs`.

The regression suite intentionally failed before the implementation fix when provider responses contained:

- a smaller amount
- a different currency
- a different PaymentIntent
- a missing PaymentIntent

The tests also require a mismatched provider refund to remain durably correlated so a retry re-reads the same refund instead of issuing a second refund POST.

GitHub Actions run `34870099983` failed at `npm test` as the expected RED phase.

### GREEN repair

Commit `c393898298d3d059a59c724ba6d7eaa165004443` changed `src/lib/commerce-refunds.ts` so a refund is locally finalizable only when all of the following hold:

1. provider status is `succeeded`
2. `refund.amount === expected full refund amount`
3. provider currency is `gbp`
4. provider `payment_intent` equals the order's stored PaymentIntent

Provider correlation is still persisted before these checks. If the provider object is unexpected, the result is `refund_unverified`, the transaction case is not finalized and a retry cannot create a second provider refund.

Existing refund test fixtures were updated to use provider-shaped refund objects in commit `9164297999cbd4912c29da572aac82b6d4f55fd5`.

## Defect B — transfer-reversal CAS race accepted a conflicting provider ID

### Root cause

The transfer-reversal persistence path already used a null-guarded compare-and-set. However, if that CAS lost a race and a reversal ID was already present, the fallback accepted any non-null stored reversal ID.

That allowed this unsafe ordering in principle:

1. Stripe returns reversal `A` for the current operation.
2. The database is concurrently populated with reversal `B`.
3. The local persistence fallback sees a non-null reversal and continues.
4. Refund creation can proceed even though provider operation `A` is not the reversal correlated in the database.

This is a provider-authority mismatch, not merely a UI problem.

### RED proof

Commit `1f5127417ff18164a19fd6864fa1800b98452461` added `scripts/test-refund-reversal-correlation.mjs` with two race cases:

- same reversal ID wins the competing write → idempotent continuation is allowed
- different reversal ID wins the competing write → processing must stop before refund creation or case finalization

GitHub Actions run `34870607101` failed at `npm test` on the conflicting-ID case as the expected RED phase. The independent PostgreSQL concurrency and marketplace-scale jobs remained green.

### GREEN repair

Commit `f1577d1a8594c60aeba6b9399100a7c41e97451b` tightened `persistTransferReversal`:

- an ID returned directly by the CAS must equal the Stripe reversal ID
- an ID found by the fallback read after a lost CAS must also equal the Stripe reversal ID
- missing correlation still fails closed
- a different stored ID now raises `Seller transfer reversal correlation mismatch.`
- the conflicting path stops before refund creation
- the same-ID race remains an idempotent success

The final full CI/Preview evidence for this commit is recorded above.

## Existing refund/reversal protections retained

The final green suite continues to cover the previously hardened behavior:

- stable refund idempotency key: `secondpart-refund-${caseId}`
- stable transfer-reversal idempotency key: `secondpart-reversal-${caseId}`
- refund provider correlation persisted before local finalization
- `pending` / `requires_action` refunds remain unresolved and retryable
- `failed` / `canceled` refunds never finalize the transaction case
- unknown refund status fails closed
- database finalization error retains provider correlation and retry reuses the same refund
- false finalization acknowledgement is treated as failure
- released seller payout is reversed before successful refund finalization
- persisted reversal correlation prevents repeat reversal
- already resolved/refunded case is a no-op
- provider-managed dispute case is not manually refunded through this path

## P0 interpretation

**Code-level Refund Authority + Idempotency hardening is VERIFIED for the tested boundary.**

The following remains **UNSIGNED provider E2E** and must not be relabelled PASS from this checkpoint:

- authenticated Preview case/refund action producing a real Stripe sandbox refund through the application path
- real Connect transfer reversal through that same application path when payout was released
- matching Stripe object IDs and amounts against post-action Supabase state
- retry/reload after provider success proving no duplicate refund/reversal objects
- webhook/reconciliation behavior for the resulting adverse transaction
- any deliberately induced provider pending/failure condition that requires provider support/test instrumentation

Do not create a direct Stripe refund solely to close this evidence gap: that would bypass the SecondPart application lifecycle and could intentionally diverge provider and database state. Use an authorized, isolated test-mode application scenario with matching UI, Stripe and Supabase evidence.
