# Mobile seller payment refresh synchronization — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint covers the mobile seller Stripe status refresh only. It does not change Stripe provider configuration, seller accounts, Supabase schema, Production, `main`, or the accepted Buyer Protection / payout policy.

## Root cause

The mobile route `src/app/api/mobile/v1/seller/payments/refresh/route.ts` was introduced before the canonical seller-payment synchronizer was hardened.

The route retained its own Stripe/account mutation logic while web checkout and the shared payment synchronizer later moved to `syncSellerPaymentAccount`. This created drift:

- the mobile route did not write `payouts_enabled`;
- a provider `restricted` status could be represented to the mobile client as `pending`;
- the route directly mutated `seller_payment_accounts` instead of sharing the canonical state transition;
- future payment-readiness repairs could again land in one path but not the other.

Hosted read-only database inspection before the fix showed the existing QA rows were internally consistent. No data repair was required.

## TDD RED

Test commit:

- `d131f07105bb5adc42287f10529f9824d9eb9cbc`
- GitHub Actions run `35344973320`

The new real-route regression harness produced the expected failures before implementation:

- shared synchronizer call count: expected 1, observed 0;
- provider `restricted` response: expected `restricted`, observed `pending`;
- shared synchronizer failure path: expected controlled HTTP 503, old route returned HTTP 200 because it never called the shared synchronizer.

Suite result at RED:

- 576 tests;
- 573 PASS;
- 3 FAIL;
- all three failures were the new mobile seller payment refresh regression cases.

## GREEN implementation

Implementation commit:

- `3c43d6f93cb512ec7425cd6cbe0061533974de38`
- message: `fix: unify mobile seller payment readiness sync`

The mobile refresh route now:

- delegates provider/database readiness synchronization to `syncSellerPaymentAccount(seller.id)`;
- no longer calls Stripe directly;
- no longer writes `seller_payment_accounts` directly;
- preserves the existing `not_started` response for a seller with no connected payout account;
- returns `restricted` for provider states `restricted`, `inactive`, `disabled`, or `rejected`;
- preserves the controlled `stripe_status_refresh_failed` HTTP 503 path.

## GREEN verification

GitHub Actions run `35345127617`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- lint: 0 errors, three unchanged legacy warnings;
- typecheck: PASS;
- test suite: **576/576 PASS**, 0 FAIL;
- all release validators: PASS;
- production Next.js build: PASS; compiled successfully.

Vercel Preview for the exact implementation SHA:

- deployment: `dpl_Hrn5bfc5hhzSY8vsgJ57Pwft2upW`;
- exact URL: `https://second-part-shop-m5nrr5aeu-joannakwapis11-5369.vercel.app`;
- branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Read-only health smoke on both the exact deployment and branch alias returned HTTP 200 with:

```json
{"ok":true,"service":"secondpart-mobile-api","apiVersion":"v1","backendReady":true}
```

The authenticated seller-payment refresh itself was not invoked against a live QA seller solely to prove the code repair; the TDD route harness covers the state contract without mutating hosted payment-account state.

## Scope limit

This closes the mobile/web seller-payment synchronization drift. It does not waive remaining provider/UI checkout scenarios, physical Android return-path testing, live Stripe configuration, Supabase Auth/plan gates, or release-device evidence.
