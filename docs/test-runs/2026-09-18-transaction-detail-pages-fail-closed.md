# Transaction detail pages fail-closed hardening — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint covers buyer order detail, seller sale detail, order timelines and the selected-purchase lookup used by Buyer Cases. It does not change transaction state, case policy, payouts, Stripe configuration, Supabase schema, Production or `main`.

## Root cause

Several detail paths collapsed backend failures into business-state absence:

- buyer order detail converted `getBuyerOrderById` failure to `null`, then called `notFound()`;
- seller sale detail did the same for `getSellerSaleById`;
- both detail pages converted order timeline loader failures to `[]`;
- Buyer Cases converted selected-purchase lookup failures to `null`;
- `getBuyerCaseOrderItem` itself returned `null` for both a real missing/unauthorised row and a Supabase query error.

That meant an outage could look like a genuine 404, a missing selected purchase or a transaction with no history.

## TDD RED

Regression commit:

- `0735e56a9decc70449d0d64a33d92d55bc136470`
- GitHub Actions run: `35351654976`

Expected RED:

- total tests: 597;
- 591 PASS;
- 6 FAIL;
- buyer and seller backend failures surfaced as `not found` instead of the original error;
- buyer and seller timeline failures were silently rendered as empty histories;
- selected purchase failure in Buyer Cases was swallowed;
- `getBuyerCaseOrderItem` returned `null` instead of distinguishing a Supabase failure.

The tests also retained the intended contract that a genuine `null` order/sale still maps to the existing 404.

## GREEN implementation

Final application SHA:

- `7b2f6bff1a6a4d718810f15de9f91ec0cd5ddbb6`

Changes:

- buyer order detail now calls `getBuyerOrderById` directly; genuine `null` still triggers `notFound()`, thrown backend errors propagate to the global retry boundary;
- seller sale detail follows the same distinction;
- order timeline failures now propagate instead of becoming an empty timeline;
- Buyer Cases no longer swallows a selected-purchase loader failure;
- `getBuyerCaseOrderItem` now throws `Buyer case purchase is temporarily unavailable.` on query failure and returns `null` only for a genuine absent/ineligible purchase.

## Final verification

GitHub Actions run `35351853027`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- tests: **597/597 PASS**, 0 FAIL;
- lint: 0 errors;
- typecheck: PASS;
- release/commerce validators: PASS;
- production Next.js build: PASS; compiled successfully.

Vercel Preview:

- deployment: `dpl_8JAB2bmwNPjtCPpiYQ9uGGveqaTB`;
- exact URL: `https://second-part-shop-pxmc970s5-joannakwapis11-5369.vercel.app`;
- stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Fresh read-only health smoke on exact deployment and branch alias returned HTTP 200 with `backendReady:true`.

## Scope limit

This closes the covered false-404 / false-empty transaction-detail paths. It does not waive provider checkout E2E, physical Android testing, Auth/plan gates, legal setup or marketplace liquidity.
