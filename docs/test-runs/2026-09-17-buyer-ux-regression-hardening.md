# Buyer UX regression hardening — 2026-09-17

Scope: `rebuild-nextjs` and Preview only. No `main`, Production configuration, financial data or Buyer Protection policy was changed.

## 1. Marketplace filters preserve the complete vehicle context

Confirmed defect: applying Advanced Filters preserved vehicle catalogue/year/registration but dropped `vc` (vehicle colour). This made the selected vehicle context incomplete after an otherwise unrelated filter action.

TDD evidence:

- RED SHA `17d295b731c9af6c50ff506775221f9828739c9e` added the regression contract. GitHub Actions `35211400808` failed exactly the two new expectations: the submit form lacked hidden `vc`, and Reset lacked `vc=blue`.
- GREEN SHA `c578d53ab0f4c78f2b79761985710ad3bf0f4bd2` preserves `vc` in both the form submission and reset destination.
- GitHub Actions `35211537964`: `validate`, `marketplace-scale-postgres` and `last-stock-concurrency` all PASS, including lint, typecheck, full tests, validators and build.
- Exact Preview deployment `dpl_3rvxWBfrsH1pvuBcYtSTdGYKz3Dv`: READY.

## 2. Garage exposes the compatibility choice consistently

Confirmed defect: Home exposed `Show only parts that fit this vehicle`, but Garage offered only `Use this vehicle`. The mobile shell Garage also forced `compatibleOnly:true`, so a user could not deliberately use a saved vehicle while browsing the full marketplace.

The repaired flow now gives every saved Garage vehicle an explicit compatibility checkbox. Checked means fit-only results; unchecked means full marketplace results with compatibility labels retained. The selected vehicle context still preserves catalogue variant, year, fuel, engine, registration and colour.

TDD evidence:

- RED SHA `356d8e265a7fdbb690c7a6a70419d00d51ce1a8b`, GitHub Actions `35211919526`: four intended Garage contract failures and no unrelated regression.
- Web implementation: `657ea9e2850f1957a1e6bacd7e2a2b1513ffb892` and `61d8a6db4887a0ba5236df6859f1f39ffc9aec98`.
- Mobile-shell parity: `eaf43ae28cf031e190f60dc038affaadf76108f0` and `d38f14e877c5d24fad8fc3c44cae8f06fadde5ae`.
- Final test boundary SHA `38593d85f2d3fc7c22c71732980b88b997b92e2e`.
- GitHub Actions `35212293699`: all three jobs PASS, including full test suite, validators and production build.
- Exact Preview deployment `dpl_GdzjALVyoqfpbprNNhhqRAFgQsp5`: READY.

## 3. Reset now resets the filters owned by the filter panel

Confirmed defect: the `Reset` action in Marketplace Filters preserved `sort` and `collection`, even though those controls belong to the panel. A buyer could press Reset while `Collection only` or a custom sort remained active.

Expected boundary:

- Reset clears `condition`, `sort`, `min`, `max` and `collection`.
- Reset preserves the search/category context, postcode and the complete selected-vehicle context.

TDD evidence:

- RED SHA `953fe919a79a76402ad0badaedfa1c99e683a7a4`, GitHub Actions `35212508057`: 566/567 tests passed and the single new reset-contract test failed as intended; the first observed mismatch was retained `sort`.
- GREEN SHA `2e783f59b74a2fee1e664f55a291d03d175103ef` removes panel-owned `sort` and `collection` from the Reset destination while retaining the surrounding buyer context.
- GitHub Actions `35212658302`: `validate`, `marketplace-scale-postgres` and `last-stock-concurrency` all PASS. `validate` includes git diff check, lint, typecheck, full tests, all release validators and build.
- Exact Preview deployment `dpl_CT4fxngL8oATQNfvop7z4uoaCPp4`, URL `https://second-part-shop-neag06xa3-joannakwapis11-5369.vercel.app`: READY.

## Result

The audited Buyer path is now internally consistent across Home/Garage vehicle selection and Marketplace filter transitions for the boundaries above. These fixes do not waive the remaining RC external/provider gates: adverse Stripe UI/provider scenarios, physical Android evidence, account-deletion lifecycle, controlled Auth/DB configuration, legal/support operations and real marketplace liquidity remain separate release prerequisites.
