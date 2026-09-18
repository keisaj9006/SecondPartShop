# Transaction screens fail-closed hardening — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint covers list/load behavior for buyer purchases, seller sales, buyer transaction cases, seller transaction cases and Admin Commerce. It does not change transaction state, case workflow, payout policy, Supabase schema, Stripe configuration, Production or `main`.

## Root cause

Several transaction-facing server pages caught loader failures and substituted valid-looking empty data:

- Purchases: failed `getBuyerOrdersPage` became `items:[]`;
- Seller sales: failed `getSellerSalesPage` became `items:[]`;
- Buyer cases: failed case/order/active-case lookups could become empty lists/sets;
- Seller cases: failed case/evidence loaders could become empty cases/evidence;
- Admin Commerce: failed case/evidence loading became empty state, while `get_unverified_delivery_payout_reviews` ignored its RPC error.

That meant a backend outage could be rendered as “No purchases”, “No sales”, “No transaction cases”, “No commerce cases” or no payout reviews. In buyer-case eligibility, an unavailable active-case lookup could also be treated as if no active case existed.

The application already has a global server-render error boundary with a retry action. The safe behavior is therefore to propagate true backend failures into that boundary rather than manufacture an empty business state.

## TDD RED

Regression commit:

- `667bb09136b85740a68a252dfacea40b27eb12f6`
- GitHub Actions run: `35350713062`

Expected RED:

- total tests: 591;
- 583 PASS;
- 8 FAIL;
- every new failure was “Missing expected rejection”, proving each tested page swallowed the injected backend failure instead of propagating it.

Covered RED cases:

- buyer purchase history loader failure;
- seller sales loader failure;
- buyer case list failure;
- buyer active-case lookup failure;
- seller case list failure;
- seller evidence loader failure;
- Admin Commerce case-list failure;
- Admin Commerce payout-review RPC failure.

## GREEN implementation

Application changes were intentionally narrow:

- `src/app/account/orders/page.tsx`: purchase loader failures now propagate;
- `src/app/dashboard/orders/page.tsx`: seller sales loader failures now propagate;
- `src/app/account/cases/page.tsx`: case/order/evidence/active-case failures now fail closed instead of becoming empty data;
- `src/app/dashboard/cases/page.tsx`: case/evidence failures now propagate;
- `src/app/admin/commerce/page.tsx`: case/evidence/payout-review failures now propagate and are reported through the existing operational monitoring boundary.

A real empty result still renders the existing normal empty-state UI.

Admin Commerce monitoring uses the existing `commerce_maintenance` component taxonomy with event `commerce_admin_data_load_failed`. No new monitoring category was introduced.

## Verification correction

The first implementation boundary `fb9830a19b30a76ad5a11b2290db462c4d9a719d` correctly exposed a typecheck issue: `commerce_admin` was not an allowed `OpsComponent`.

This was not a transaction-behavior failure. The monitoring component was aligned to the existing `commerce_maintenance` taxonomy rather than expanding the enum:

- taxonomy correction: `1ef8310eeaf68e29c8cbee4e241bb8d63306cdef`;
- test alignment: `bcef9f5a4044967842a77a3995ede8081ef0b473`.

## Final verification

GitHub Actions run `35351147618` on final SHA `bcef9f5a4044967842a77a3995ede8081ef0b473`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- tests: **591/591 PASS**, 0 FAIL;
- lint: 0 errors;
- typecheck: PASS;
- release/commerce validators: PASS;
- production Next.js build: PASS; compiled successfully.

Vercel Preview:

- deployment: `dpl_625nAoAWQRmnPSeyWiBSr1vdzpjX`;
- exact URL: `https://second-part-shop-da433i9yl-joannakwapis11-5369.vercel.app`;
- stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Fresh read-only health smoke on exact deployment and branch alias returned HTTP 200 with `backendReady:true`.

## Scope limit

This closes false-empty behavior for the covered transaction list/admin screens. Detail pages that currently collapse some loader failures into `notFound()` remain a separate boundary and are not claimed closed by this checkpoint.
