# Marketplace navigation QA — 12 September 2026

Status: regression reproduction recorded; fixed Preview verification pending. No payment/provider transaction is part of this test.

## Before

- Search reproduction on Preview `085d9b9`: from `/?q=alternator&page=4#marketplace`, enter DSG and submit. URL became `/?q=DSG&page=4#marketplace`, reporting three matches but showing no cards.
- Removing the marketplace vehicle chip cleared URL state, but reloading restored the previous Vauxhall selection from localStorage. Garage records were not changed.
- On exact-HEAD Preview `d243fdb50dbd200b750d75b751b7e1761ebbe0bd`, both aliases resolve to `dpl_Emre8wSxGZDtKrUkVxfqgmTFEGoP`; CI `34683491907` succeeded. Public mobile GET `/api/mobile/v1/marketplace?limit=1` returned a cursor. Passing that returned cursor unchanged into the next request repeated listing `40000000-0000-0000-0000-000000000006` instead of advancing.

## Implementation checks

Initial implementation: 13 focused and 74 full tests, lint, typecheck, build and all 14 targeted validators passed. Independent review then reproduced two uncovered edge cases: submitted-query Back navigation and a throwing localStorage property getter. Both require regression fixes before publication; initial green tests are not final acceptance.

Review round 1 fixed both cases and added the exact returned-token mobile round trip. Independent specification and quality rereview approved. Fresh full suite: 76/76 pass; focused navigation/mobile tests: 15/15; lint and typecheck pass. The full build was rerun after those fixes and passed. The 14 targeted validators passed before the four-file review fix, which changed only query state/storage exception handling and its tests. Actual fixed Preview checks follow deployment; they remain pending here.
