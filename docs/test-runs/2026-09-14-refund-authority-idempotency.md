# SecondPart P0 refund authority and idempotency — 2026-09-14

This checkpoint records the refund/reversal hardening verified on `rebuild-nextjs`. It separates code/CI/Preview evidence from provider-level mutation evidence. No Stripe refund, transfer reversal, case creation, payout mutation or destructive database operation was executed while producing this checkpoint.

## Final verified code boundary

- Final application SHA: `a6e8639f04bc4d91681b386bc6868ee3a222e2e8` — `test: align refund retry fixture with provider readback`
- Effective production-code changes are contained in the preceding application commits through `8f6e03efa63109c21b725dff858478d284b43463`; `a6e8639f...` aligns the pre-existing regression fixture with the now-required provider readback contract and proves it in the full suite.
- GitHub Actions run: `34873770345` (`rebuild-nextjs QA`, run 1894)
- `validate`: PASS
  - `git diff --check HEAD^ HEAD`: PASS
  - lint: PASS
  - typecheck: PASS
  - full `npm test`: PASS
  - all release validators: PASS
  - production build: PASS
- `last-stock-concurrency`: PASS
- `marketplace-scale-postgres`: PASS, including the isolated 100k search proof and single-scan verification
- Exact-SHA Vercel Preview: `dpl_A1DkZmuFzzBqADSt7k4xjDaZgRoq` — READY
- Preview branch alias: `second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`
- Deployment metadata reports `githubCommitRef=rebuild-nextjs` and `githubCommitSha=a6e8639f04bc4d91681b386bc6868ee3a222e2e8`.

This proves the implemented code boundary and deployment alignment. It does not by itself prove a real Stripe refund/reversal lifecycle through the authenticated Preview UI.

## Baseline provider/database fixture — read-only

The existing successful Stripe sandbox happy-path fixture was inspected without mutation:

- order: `d53fc4eb-9830-4956-8e6f-2ced3ea37a72`
- order item: `24fcf358-dba3-4278-9740-79eaa89f0681`
- PaymentIntent: `pi_3UEaav2RWsyIBCbK1Z4TppDc`
- seller transfer: `tr_3UEaav2RWsyIBCbK1ZxP18jl`
- Stripe platform sandbox account: `acct_1UEUN72RWsyIBCbK`
- `livemode=false`

Post-hardening readback after the final GREEN commit:

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
- a different stored ID raises `Seller transfer reversal correlation mismatch.`
- the conflicting path stops before refund creation
- the same-ID race remains an idempotent success

This intermediate repair passed its full CI/Preview gate before later review found the amount-authority gap.

## Defect C — successful transfer reversal amount was not verified

### Root cause

After Stripe returned a transfer-reversal object, the application validated/persisted the reversal ID but did not verify that the provider had reversed exactly the seller payout amount requested by SecondPart.

A provider object with the expected reversal ID but a different amount could therefore have been accepted as authority to continue into refund creation.

### RED proof

Commit `8b3f18836c2816b00ecb086be628e447845aeda6` extended `scripts/test-refund-reversal-correlation.mjs` with a provider response returning `amount=2199` when `seller_net_pence=2200`.

Required behavior:

- reversal provider call occurs once
- processing fails closed with reversal amount mismatch
- no reversal correlation is accepted as a successful local transition
- no refund is created
- no transaction-case finalization occurs

GitHub Actions run `34871566059` failed at `npm test` as the expected RED phase. The separate last-stock concurrency and marketplace-scale jobs still passed, proving the RED was localized to the new financial assertion.

### GREEN repair

Commit `a8b6bc0d00c8f4579f0be2808c04a47e805bb03a` verifies `reversal.amount === item.seller_net_pence` immediately after the Stripe reversal response and before reversal persistence/refund creation.

If the amount differs, the operation raises `Seller transfer reversal amount mismatch.` and stops before creating a refund. The Stripe reversal request keeps the existing stable `secondpart-reversal-${caseId}` idempotency key, so a retry cannot create a second reversal merely because provider response verification failed.

## Defect D — a persisted reversal was trusted without provider revalidation on retry

### Root cause

After a reversal ID had been durably stored in `order_items.provider_transfer_reversal_id`, a later refund retry treated the database correlation itself as sufficient proof that the provider reversal was authoritative. The retry correctly avoided a second reversal POST, but it did not re-read the exact Stripe reversal before continuing to refund creation.

That left a provider-authority gap: a persisted reversal correlation could be present while its provider amount was not revalidated against the exact expected `seller_net_pence` on the retry path.

### RED proof

Commit `10a10f86191d74103b72993be2d548e350976c62` extended `scripts/test-refund-reversal-correlation.mjs` with two persisted-reversal scenarios:

- exact persisted reversal amount → retry must GET the exact reversal from Stripe, perform zero additional reversal POSTs, then may continue
- mismatched persisted reversal amount → retry must GET the exact reversal and stop before refund creation/finalization

GitHub Actions run `34872992307` failed exactly on those two new assertions.

Commit `be561a6b17422beb2e53f281ea4aeb5b0c0174e3` then added the adapter-level contract in `scripts/test-stripe-payments.mjs`. It required a direct provider read at `GET /v1/transfers/{transfer}/reversals/{reversal}`. GitHub Actions run `34873235032` failed with the expected missing-adapter-method error before implementation.

### GREEN repair

Commit `52afe28372d901e6314689d30e4ff8e6004f67bd` added `getSellerTransferReversal(transferId,reversalId)` in `src/lib/stripe-payments.ts`, using Stripe's direct single-reversal GET endpoint.

Commit `8f6e03efa63109c21b725dff858478d284b43463` changed `refundTransactionCase` so a released payout with an already-persisted reversal ID now:

1. performs no new reversal POST
2. re-reads that exact reversal from Stripe using the stored transfer ID and reversal ID
3. requires `reversal.amount === item.seller_net_pence`
4. stops with `Seller transfer reversal amount mismatch.` before any refund creation if provider authority does not match

The first GREEN attempt correctly exposed one stale legacy mock in `scripts/test-commerce-refunds.mjs`; the new behavioral and adapter tests themselves were already passing. Commit `a6e8639f04bc4d91681b386bc6868ee3a222e2e8` aligned that old fixture with the new provider-readback contract and strengthened the existing retry regression to assert:

- exactly one reversal POST across both attempts
- exactly one provider reversal readback on retry
- exactly one refund POST
- the correlated refund is read rather than recreated

GitHub Actions run `34873770345` then passed the full branch gate, including production build and both PostgreSQL jobs.

## Existing refund/reversal protections retained

The final green suite continues to cover the previously hardened behavior:

- stable refund idempotency key: `secondpart-refund-${caseId}`
- stable transfer-reversal idempotency key: `secondpart-reversal-${caseId}`
- refund provider correlation persisted before local finalization
- exact refund amount, GBP currency and PaymentIntent verification
- `pending` / `requires_action` refunds remain unresolved and retryable
- `failed` / `canceled` refunds never finalize the transaction case
- unknown refund status fails closed
- database finalization error retains provider correlation and retry reuses the same refund
- false finalization acknowledgement is treated as failure
- released seller payout is reversed before successful refund finalization
- newly-created transfer reversal amount must equal the exact expected seller net payout
- persisted reversal correlation prevents repeat reversal POSTs
- persisted reversal is re-read from Stripe and its amount is revalidated before a retry can create/finalize a refund
- reversal CAS conflicts require exact provider ID equality
- already resolved/refunded case is a no-op
- provider-managed dispute case is not manually refunded through this path

## Scope review

Comparison from pre-batch checkpoint `f43211f1f39981cb82cc49cc8b69b019cfc816e9` through final application SHA `a6e8639f04bc4d91681b386bc6868ee3a222e2e8` is confined to the refund/reversal hardening boundary and its tests/evidence, including:

- `src/lib/commerce-refunds.ts`
- `src/lib/stripe-payments.ts`
- `scripts/test-commerce-refunds.mjs`
- `scripts/test-refund-provider-authority.mjs`
- `scripts/test-refund-reversal-correlation.mjs`
- `scripts/test-stripe-payments.mjs`
- refund/provider evidence documents

No unrelated marketplace subsystem was intentionally changed in this batch.

## P0 interpretation

**Code-level Refund Authority + Idempotency hardening is VERIFIED for the tested boundary.**

The following remains **UNSIGNED provider E2E** and must not be relabelled PASS from this checkpoint:

- authenticated Preview case/refund action producing a real Stripe sandbox refund through the application path
- real Connect transfer reversal through that same application path when payout was released
- matching Stripe object IDs and amounts against post-action Supabase state
- retry/reload after provider success proving no duplicate refund/reversal objects
- webhook/reconciliation behavior for the resulting adverse transaction
- any deliberately induced provider pending/failure condition that requires provider support/test instrumentation

Current hosted prerequisites discovered while preparing that proof:

- a disposable `SecondPart QA Seller` draft now exists with stock 1, a real photo, a selectable category, an owned Vauxhall Astra 2017 donor, truthful compatibility evidence, current marketplace terms and payout-ready Stripe Connect status
- Preview currently has no profile with role `admin`, while application refund approval correctly requires `requireAdmin`
- the current chat has no connected interactive browser session; TinyFish was suggested for authenticated Preview navigation but remains unconnected at this checkpoint

Do not create a direct Stripe refund solely to close this evidence gap, publish the listing through SQL, or silently elevate an existing buyer/seller role to admin. Those actions would bypass the SecondPart lifecycle or weaken the evidence boundary. Use the normal authenticated application flow with a dedicated QA admin and preserve matching UI, Stripe and Supabase evidence.
