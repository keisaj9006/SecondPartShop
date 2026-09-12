# Marketplace navigation QA — 12 September 2026

Status: PASS for Task 3 navigation acceptance on the verified Preview below. No payment/provider transaction is part of this test.

## Before

- Search reproduction on Preview `085d9b9`: from `/?q=alternator&page=4#marketplace`, enter DSG and submit. URL became `/?q=DSG&page=4#marketplace`, reporting three matches but showing no cards.
- Removing the marketplace vehicle chip cleared URL state, but reloading restored the previous Vauxhall selection from localStorage. Garage records were not changed.
- On exact-HEAD Preview `d243fdb50dbd200b750d75b751b7e1761ebbe0bd`, both aliases resolve to `dpl_Emre8wSxGZDtKrUkVxfqgmTFEGoP`; CI `34683491907` succeeded. Public mobile GET `/api/mobile/v1/marketplace?limit=1` returned a cursor. Passing that returned cursor unchanged into the next request repeated listing `40000000-0000-0000-0000-000000000006` instead of advancing.

## Implementation checks

Initial implementation: 13 focused and 74 full tests, lint, typecheck, build and all 14 targeted validators passed. Independent review then reproduced two uncovered edge cases: submitted-query Back navigation and a throwing localStorage property getter. Both require regression fixes before publication; initial green tests are not final acceptance.

Review round 1 fixed both cases and added the exact returned-token mobile round trip. Independent specification and quality rereview approved. Fresh full suite: 76/76 pass; focused navigation/mobile tests: 15/15; lint and typecheck pass. The full build was rerun after those fixes and passed. The 14 targeted validators passed before the four-file review fix, which changed only query state/storage exception handling and its tests. Actual fixed Preview checks follow deployment; they remain pending here.

## Verified Preview acceptance

- Code commit: `25864104d8b01e8d0ca9196ab90ffca7f1580a05`; CI `34684324225` successful.
- READY Preview: `dpl_HR78y9LWW6qwfqwKi7SuCCRiizLQ`, `second-part-shop-b7pa95iyy-joannakwapis11-5369.vercel.app`. Both stable Preview and rebuild-nextjs aliases were read back at this deployment; remote branch equals the code commit.
- Actual browser: from `/?q=alternator&page=4#marketplace`, submit DSG. Result is `/?q=DSG#marketplace`, three matching listings and three cards. Back restores `alternator` in both URL and input. Submitting DSG again after Back again removes page/cursor and renders the three cards.
- Actual browser: a typed, unsubmitted `QA unsubmitted draft` survives opening Browse categories while the committed URL remains DSG.
- Actual browser: View part preserves `q=DSG&sort=best`; Back to results returns to that context and renders the same three cards.
- Actual browser on this same deployment: removing the selected Vauxhall marketplace chip clears the URL; reload retains the cleared selection. The Garage vehicle record remains present; it was not deleted.
- Public HTTP mobile roundtrip repeated on this deployment: `limit=1` returns `40000000-0000-0000-0000-000000000006`; passing its exact returned nextCursor into the second request returns `40000000-0000-0000-0000-000000000005`, with cursor mode. No static fabricated cursor was substituted.
- Fresh resumed-checkpoint verification: 15/15 focused navigation/mobile tests; 80/80 current working-tree tests (includes four separate uncommitted OPS tests); lint exit 0 with three existing mobile-shell unused-variable warnings; typecheck, build, diff check and all 14 repository validators passed. The deployed navigation commit itself previously passed 76/76 tests and the independent round-1 semantic review.
- Getter/property and removeItem exceptions are covered at actual component-handler boundaries using the real helper. No browser security setting was changed to simulate a blocked storage getter.

These results certify the bounded navigation task, not physical-device RC, provider payment E2E, or overall launch readiness. No payment, onboarding, account/profile removal or fabricated fitment was performed.
