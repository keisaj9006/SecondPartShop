# Web seller Stripe onboarding return sync — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint covers the automatic seller-payment synchronization performed when a seller returns from Stripe onboarding on the web dashboard. It does not alter Stripe account configuration, payout policy, Buyer Protection, Supabase schema, Production or `main`.

## Root cause

`src/app/dashboard/payments/page.tsx` already called the canonical `syncSellerPaymentAccount(seller.id)` on `?returned=1`, but the call used `.catch(()=>null)`.

That created two problems when provider/database synchronization failed:

- the failure was silently swallowed with no operational monitoring event;
- the UI still told the seller that “SecondPart re-checked the account automatically”, even though the re-check had failed.

The success and normal pending/restricted return paths themselves were already correct.

## TDD RED

Regression commit:

- `05307bdd332563d15b7e1b8c1c4afdef6adcdd96`
- GitHub Actions run: `35347039313`

Expected RED:

- test suite: 581 total;
- 579 PASS;
- 2 FAIL;
- failure path produced no monitoring event;
- failure path still rendered the false “re-checked automatically” claim;
- success path remained green.

## GREEN implementation

Implementation commit:

- `02ea63dab48496424a12034d0fb2c3c9b8106268`
- message: `fix: surface Stripe onboarding return sync failures`

The return flow now:

- explicitly catches synchronization failures;
- reports `payout / seller_stripe_onboarding_return_sync_failed` through the existing operational monitoring boundary;
- renders an error-state banner that says the automatic refresh failed and tells the seller to use `Refresh status`;
- does not claim the account was successfully re-checked when synchronization failed;
- preserves the existing success and non-active/pending return UX.

## Final verification

GitHub Actions run `35347166356`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- tests: **581/581 PASS**, 0 FAIL;
- release/commerce validators: PASS;
- production Next.js build: PASS; compiled successfully.

Vercel Preview for the exact application SHA:

- deployment: `dpl_Gs1XTV56sMEkdH34xpXqmDzHZU3G`;
- exact URL: `https://second-part-shop-9k303drs6-joannakwapis11-5369.vercel.app`;
- stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Fresh read-only health smoke on both exact deployment and branch alias returned HTTP 200 with `backendReady:true`.

## Scope limit

This closes the silent-failure / false-success messaging gap on the web Stripe onboarding return. It does not waive physical Android return-path QA, provider adverse checkout E2E, Supabase Auth/plan gates, live Stripe configuration or legal/operational release gates.
