# Web seller payment refresh synchronization — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint covers the manual web seller Stripe status refresh only. It does not change Stripe provider configuration, connected seller accounts, Supabase schema, Production, `main`, or the accepted Buyer Protection / payout policy.

## Root cause

`src/app/dashboard/payments/actions.ts` retained a second private copy of seller Stripe readiness synchronization after the canonical `syncSellerPaymentAccount` path was hardened.

The duplicated web refresh path:

- fetched the Stripe recipient account directly;
- collapsed every non-active provider status to `pending`;
- wrote `onboarding_status`, `transfers_enabled`, `payouts_enabled` and `details_submitted` directly;
- could therefore diverge from checkout, automatic return-sync and mobile refresh semantics.

The canonical synchronizer already owns these provider/database transitions and preserves restricted/details semantics.

## TDD RED

Regression commit:

- `a1f4f03e1fa427f4fe978ddc0160c377d3eedfa3`
- GitHub Actions run: `35345771596`

Expected RED:

- manual web refresh did not call the shared synchronizer;
- a shared synchronizer failure could not drive the existing controlled `?error=sync` redirect because the action never invoked it.

Only the two new web seller payment refresh regression cases failed.

## GREEN implementation

Implementation commit:

- `f51a3e7f15927fe01a7b217bc212737016c591ff`
- message: `fix: unify web seller payment readiness sync`

The manual web refresh now:

- delegates provider/database readiness synchronization to `syncSellerPaymentAccount(seller.id)`;
- no longer retrieves the Stripe recipient directly;
- no longer writes `seller_payment_accounts` directly;
- preserves the existing page revalidation;
- preserves the existing success/error redirects;
- preserves `seller_stripe_status_sync_failed` operational monitoring on failures.

Seller onboarding account creation remains unchanged.

## Validator alignment

The first GREEN execution correctly exposed a stale implementation-detail invariant in `scripts/validate-commerce-e2e-harness.mjs`.

The old validator required the web action itself to contain direct `payouts_enabled:complete` and `transfers_enabled:complete` writes. That contradicted the new single-source-of-truth design even though the canonical synchronizer still independently guarantees those fields.

Validator alignment commit:

- `c830cb6f85812c682a6dfc0cfb07393102b74104`
- message: `test: align commerce gate with shared seller sync`

The gate now requires the manual action to delegate to `syncSellerPaymentAccount` and prohibits the old direct readiness writes, while the separate canonical synchronizer invariant continues to require persisted payout/transfer readiness.

## Final verification

GitHub Actions run `35346135192`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- lint: 0 errors, three unchanged legacy warnings;
- typecheck: PASS;
- test suite: **578/578 PASS**, 0 FAIL;
- commerce E2E harness and all release validators: PASS;
- production Next.js build: PASS; compiled successfully.

Vercel Preview for exact final SHA `c830cb6f85812c682a6dfc0cfb07393102b74104`:

- deployment: `dpl_AjwpfCWpzAPL4BFBaQQx9mwsp9VH`;
- exact URL: `https://second-part-shop-myjxtivnw-joannakwapis11-5369.vercel.app`;
- stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Read-only health smoke on both exact deployment and branch alias returned HTTP 200 with:

```json
{"ok":true,"service":"secondpart-mobile-api","apiVersion":"v1","backendReady":true}
```

No hosted seller payment account was mutated solely to prove this repair.

## Scope limit

This closes the manual web seller-payment synchronization drift. It does not waive remaining provider/UI checkout scenarios, physical Android testing, live Stripe configuration, Supabase Auth/plan gates, legal/operational setup or release-device evidence.
