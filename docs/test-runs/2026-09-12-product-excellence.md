# Product Excellence evidence — 12 September 2026

Baseline `77b42dc171d976aea86452b18766c818e3960356`, matching origin and clean tree. Prior Marketplace Integrity acceptance remains intact. This report is in progress, not phase/RC PASS.

## Batch 1 baseline

Actual Preview at 390×844: Make/Model combobox inputs have null aria-label and aria-activedescendant; IDs are based on placeholder strings. Current option buttons lack tabIndex=-1 and there is no active-option scroll handling in the component. Code reduced-motion rules leave html smooth scrolling and fade-up enabled. Header disclosure controls lack expanded/controls. These are scoped repairs, not a vehicle-selection redesign.

Agent Browser, separate anonymous public Preview session: `matchMedia('(prefers-reduced-motion: reduce)').matches=true`, but computed root `scrollBehavior=smooth` and both `.animate-in` elements still report `animationName=fade-up`. This reproduces the motion defect in a real Chromium browser, independently of source assertions. No QA cookie or credential was copied into this session.

Broader anonymous Home axe 4.12.1 baseline: 41 passed rules, one `landmark-unique` violation (unnamed desktop header navigation), one incomplete contrast rule covering gradient-backed elements. The incomplete contrast result is not a PASS. Header landmark names are included in this batch; a mobile menu name must remain distinct from the existing bottom `Mobile navigation` landmark. No modal dialog/focus-trap was added to the existing in-flow menu.

## Batch 2 baseline measurements

Same Preview, existing QA Buyer browser session, 390×844. Existing application navigation timing logs measure click-to-committed pathname, not paint, LCP, network duration or physical-device performance. Warm run on 12 September around 14:51–14:55 UTC:

| Transition | Baseline ms |
| --- | ---: |
| Home → Garage | 103 |
| Garage → Purchases | 54 |
| Purchases → Inbox | 40 |
| Inbox → Account | 125 |
| Account → Inbox | 43 |
| Inbox → Purchases | 533 |
| Purchases → Garage | 1018 |
| Garage → Home | 135 |

Eight observations: median 114 ms, max 1018 ms. A single small warm run is not a statistical performance guarantee. All destinations completed through client navigation; early AX snapshots sometimes preceded final commit, so the existing application logs are the timing authority. No invented cold/slow-network result.

Source baseline schedules two explicit warming passes of all five routes after every pathname (10 prefetch invocations), in addition to Link prefetch and pointer intent. Next may deduplicate network work; invocation count is not a measured HTTP request count.

Browser Back baseline passes: Home scrollTop 2217.6001 → Garage → Back restores 2217.6001 exactly. Do not replace working native history/scroll behavior with custom restoration. Existing getCurrentUser/getCurrentProfile already use React cache and categories use the existing cache; no unproven data-layer refactor is planned.

Local production build at the baseline application code, unique client-reference-manifest JS dependencies (shared chunks included, framework/runtime outside this manifest not included):

| Route | Chunks | Raw bytes | Estimated gzip bytes |
| --- | ---: | ---: | ---: |
| Home | 4 | 100315 | 32175 |
| Garage | 3 | 45377 | 14449 |
| Purchases | 3 | 49224 | 15550 |
| Inbox | 3 | 45377 | 14449 |
| Account | 3 | 68152 | 22199 |

Measured from actual .next client-reference manifests and local chunk bytes; gzip is local zlib estimation, not observed Vercel transfer. These are dependency-footprint comparisons, not total first-load JS or exclusive per-route bundles. No heavy dependency is removed without evidence.

## Batch 6 baseline

Actual 390×844 Home screenshot shows header search icon overlapping the SecondPart wordmark when the signed-in buyer also has seller access. The fixed bottom navigation remains visible and the page content fits below it. Repair should reduce redundant topbar icon density at the narrow breakpoint, keeping Garage/Account/Seller destinations available through existing bottom/menu navigation. No decorative asset is needed.

## Deferred RC and external gates

SEO entry observation: public product HTTP200 has the generic root title, no Product JSON-LD, no robots meta and no X-Robots-Tag. Canonical is absent, which must remain so until a valid approved production origin is available.

No new Stripe payment/refund/dispute/reversal/decline-retry/concurrent checkout, real email, Storage outage, destructive account deletion, physical Android/FCM, Production configuration, external two-session SQL or shared 100k load test. Their existing unchecked status is unchanged. Real screen-reader/device execution is separate from semantic and browser keyboard checks.

## Batch 1 implementation and review

Implementation passed local release checks and is ready for the Batch1 code commit; Preview acceptance follows that exact deployment. Stable instance/value option IDs, named combobox/listbox, input-focused deliberate keyboard selection, status messages and conditional active-option scrolling are implemented. Header menus expose disclosure state and restore focus on Escape; desktop Primary navigation and Mobile menu names are distinct from the bottom Mobile navigation. Reduced-motion rules now win the CSS cascade and preserve meaningful static orientation/loading cues.

Independent semantic/accessibility review found two Important issues in the initial implementation: unnamed popup listbox and stale keyboard intent reviving after disabled/empty options returned. Both were reproduced with failing regression assertions, repaired and independently re-reviewed PASS. Controller also corrected the reduced-motion cascade and a duplicate mobile landmark name before release.

Final focused tests: 11/11. Full tests: 244/244, zero skipped/failed. Lint: no errors, three pre-existing warnings in the legacy mobile-shell files. Final typecheck and build exited0; repeated14validators all exited0; diff-check passed. Preview acceptance is pending. No RC or physical screen-reader completion is implied.

### Preview correction after initial code commit

Code commit `13f947cb159f647af35e6bfa366501165eda9bf0` passed CI run34703304690 and deployed as READY Preview `dpl_HwEWRcZ8UMqKqAUUAkvkrbA3RgeD` (second-part-shop-6kwnr8x83-joannakwapis11-5369.vercel.app). Stable and branch aliases both matched that deployment.

Actual390×844 QA Buyer browser acceptance: ArrowUp moves to the last displayed Make option and scrolls the list (scrollTop3485.6); focus remains on Make and active descendant points to a rendered option. Escape closes without selecting. Empty query result leaves Enter inert; Tab closes and moves to the next enabled control. BMW selected only after ArrowDown+Enter; its ID stays stable after filtering/reopening. Once models load, Tab moves Make→Model without selecting a new make. Header mobile-menu Escape returns focus to Open navigation with expanded=false. No vehicle was applied or saved and no QA data was mutated.

Anonymous Chromium reduced-motion check: media=true, computed html scrollBehavior=auto (baseline smooth), both entry animation names=none (baseline fade-up). Open BMW list axe4.12.1:44passed rules,0violations,1incomplete contrast rule. Empty-result axe exposed aria-required-children: role=status was nested in listbox. Batch1 was deliberately left unaccepted despite earlier unit/review results.

Correction: empty feedback is now a separate named status associated with the combobox through aria-describedby; it does not render an empty listbox or claim an expanded options popup. Restored matches restore the normal listbox. Exact new regression witnessed RED then GREEN; focused12/12 and full245/245 pass. Corrected Preview acceptance and final check details follow below; gradient contrast remains an incomplete automated result, not inferred PASS.
Post-empty-state fix local gates: focused12/12, full245/245, lint0errors/3existing warnings, typecheck0, build0, diff-check clean, all14validators0; scoped semantic re-review PASS. Final Preview empty-state axe remains pending deployment.

### Batch1 acceptance: PASS (scoped engineering and Preview gate)

Final code `11a0b7b156e51583bbbcd82124fe545977b28e08`, CI34703923277 success; READY Preview `dpl_6cX65wap2ttZ6LHHXfuQYgPeqV4o`, second-part-shop-kg1h9w8yl-joannakwapis11-5369.vercel.app. On this exact version, actual anonymous390×844 Chromium empty-result axe:39passed,0violations,1incomplete contrast rule. Restored BMW list:42passed,0violations,1incomplete. The input has expanded=false, no listbox, and describedby points to the visible No matching options status. Enter remains inert; matching text restores the options. Reduced-motion still computes auto scroll and no entry animations. The already-tested mobile menu had39passed/0violations. Incomplete gradient contrast and physical screen-reader/device testing remain separate; this is not a blanket WCAG certification or RC PASS.

Batch1 commits:13f947c (accessible picker/header/motion) and11a0b7b (Preview-discovered empty-result semantics). Final local checks:12focused,245full,0failed/skipped; lint0errors/3existing warnings; typecheck/build/diff-check and14validators PASS. Independent semantic review has no remaining findings. Continue at Task2 measured mobile navigation, without repeating this audit.

## Batch2 implementation and local verification

Removed both five-route imperative prefetch passes and pointer duplicate; kept Link prefetch=true. Next Link owns pending feedback, while aria-current follows the committed pathname. Cancelled attempts cannot leave selection/timing behind for a later Back/Forward change. Loading status text sits outside busy content and decorative skeletons are hidden from accessibility APIs; geometry is unchanged.

Independent semantic review approved the scoped change with no blocking findings. Root focused6/6 and full251/251 passed, with no failures/skips. Lint0errors/3existing warnings, typecheck0, build0, diff-check and all14validators0. Exact Preview timings/Back/scroll remain pending deployment; no speed or HTTP-request reduction is claimed from removing10explicit calls.

Local client-manifest dependency footprint after Batches1–2 (same method and limitations as baseline; cumulative comparison, not isolated Task2 attribution):

| Route | Chunks | Raw bytes | Estimated gzip bytes |
| --- | ---: | ---: | ---: |
| Home | 4 | 101826 | 32774 |
| Garage | 3 | 45883 | 14615 |
| Purchases | 3 | 49730 | 15711 |
| Inbox | 3 | 45883 | 14615 |
| Account | 4 | 68772 | 22986 |

This modest increase includes the accessibility fixes and changed chunk boundaries. No heavy new library was added, and this is not a total-first-load/network-transfer measurement or evidence of bundle reduction.

### Batch2 Preview acceptance: PASS (navigation); performance comparison inconclusive

Commit ca611339e94303e6492ef9ea5a73f56c3fa7eeb5 passed CI34705355569 and deployed READY as dpl_7fuG36R8hpcT7LUdxtBcconsY3Li (second-part-shop-9aidu0rqq-joannakwapis11-5369.vercel.app). Stable Preview was assigned only after exact-SHA/READY/CI confirmation.

QA Buyer completed the same eight bottom-navigation transitions, forward and reverse, on the deployed code: Home→Garage99ms, Garage→Purchases61ms, Purchases→Inbox38ms, Inbox→Account121ms, Account→Inbox33ms, Inbox→Purchases41ms, Purchases→Garage33ms, Garage→Home103ms. Median51ms/max121ms versus baseline114/1018ms. These are warm-session click-to-pathname logs, not paint/LCP/network measurements. Actual post-run CSS viewport was586×781 (client574), despite the earlier requested mobile dimensions; the baseline used390×844. Because viewport and cache conditions are not controlled equivalently, this is NOT evidence of a quantified performance improvement. All routes remained in the mobile layout.

A separate narrow-layout Back check at actual298×644 preserved scrollTop1292.2137451171875 exactly across Home→Garage→Back; Home alone retained aria-current. No QA record was changed. Browser Back, route completion and reverse navigation passed. Removal of10imperative prefetch invocations is component evidence only; no HTTP-request reduction is claimed. Local251tests, six focused regressions, lint/typecheck/build and14validators remain passing as recorded above. Physical hardware Back and device performance remain RC gates.

Batch3 pre-change Preview observations on ca61133: QA Garage Add a vehicle opens addVehicle=1 with no previous selection. Use this vehicle explicitly restores saved Astra2017/Petrol1400. Fit enabled gives0 and a truthful No compatible matches yet plus Find My Part form; no request submitted. Unticking fit retains vehicle context with fit=0 and gives6. Remove active vehicle then reload leaves no Remove vehicle control and no cv/cy/cf/ce in URL; Garage record was not removed. Existing correct semantics are preserved, not reimplemented.

Batch4 additional confirmed finding: saving DSG Solenoid Repair Set on the main card updates only that card; its Recently viewed copy incorrectly remains Save part. The QA Buyer operation was reversed using the main card and verified after reload: both copies returned to Save part. No other saved record changed. Add a two-instance regression to the scoped feedback repair.

Both stable and branch aliases were read through Vercel API after Batch2 assignment and point to dpl_7fuG36R8hpcT7LUdxtBcconsY3Li.

Buyer detail read-only pass: DSG detail exposes price GBP189.00, free delivery, New/12stock, genuine missing-photo/evidence states, and disabled checkout with seller-unavailable explanation; no payment attempted. Confirmed P2 empty-fitments copy leaks legacy QA terminology and refers to confidence above when no vehicle is selected. Task4 includes a minimal truthful copy fix with render regression, no compatibility logic change.

## Batch3 local implementation

The ambiguous engine selector was hidden after a registration result resolved one variant but no exact engine. It now reveals the required blank engine/fuel choice and actionable guidance. Single-engine selection remains automatic; no engine is inferred for ambiguous results. Technical setup/legacy-QA vehicle copy is replaced with truthful user guidance, including a separate manual-only case.

Actual component RED/GREEN regressions cover adverse async catalogue ordering, preserved year/version, disabled apply until deliberate engine selection, exact cf/ce/vr/vc context, unchanged automatic single-engine flow and manual wording. Root focused10/10 and full255/255 passed, no skips/failures. Lint0errors/3existingwarnings, typecheck0, build0, diff-check0, mobile-performance and launch-baseline validators0. Independent review and exact Preview code acceptance are pending. No checkout/server compatibility code or QA database record changed in this repair.

Additional buyer read-only acceptance on ca61133: public Gearbox Lab UK profile shows actual business identity,2active parts,0completed sales,New rating and No published transaction reviews yet. Existing QA Purchases loads2order links with Paid/Completed and Cancelled states. No order detail mutation, checkout or provider operation occurred. Pathname can commit before streamed page content is ready; the mobile timings above deliberately do not claim content/paint readiness.

Task3 independent review required a further correction: multi-engine fuel-only evidence with null capacity could choose the first capacity. A minimal exact-evidence guard and two regression controls are in progress. Earlier local255/build success is not final acceptance of the corrected code.

Batch3 correction accepted by scoped independent rereview: multiple-engine automatic matching now requires non-null exact capacity and matching fuel. The null-capacity regression witnessed RED then GREEN; the exact-capacity positive control and single-engine automation remain passing. Final root12focused/257full tests pass with no skips/failures; post-fix lint0errors/3legacywarnings, typecheck0, build0, diff-check0, mobile-performance0 and launch-baseline0. Ready for code commit and exact-SHA Preview acceptance; no provider E2E is inferred.

### Batch3 acceptance: PASS (scoped engineering and Preview)

Commit612f9bbd1dccfd362b9044f79fa702482865ac94, CI34707231526 success, READY Previewdpl_FMvDqW5Kby5YBLm1mR5gxy1QdqT8 at second-part-shop-n7o5pgsoy-joannakwapis11-5369.vercel.app. Vercel API confirmed both stable and branch aliases point to that deployment after exact-SHA/CI verification.

Actual QA Buyer browser on this code: Home shows the new actionable UK-registration/manual guidance. Keyboard Make→Vauxhall and Model→Astra plus Year2017/Version ASTRA GTC SPORT S/S expose actual catalogue options Gas1400 and Petrol1400. Selection remains blank, Use this vehicle disabled, generic exact-engine-unconfirmed guidance visible. Deliberately selecting Petrol1400 enables Use this vehicle. The button was NOT submitted; reload discarded the in-memory selection. No Garage record/provider request was created or changed. Registration-result ambiguity and partial capacity remain synthetic component boundary evidence, not real provider E2E. Final12focused/257full, lint/typecheck/build/diff-check/mobile-performance/launch-baseline passed; independent rereview no open findings. Batch4 work continues.

## Batch4 implementation and local acceptance

SaveButton now uses only successful server results for saved state, synchronizes mounted copies in the current tab, handles false/thrown failures with bounded feedback, guards repeat activation, and preserves the exact safe internal login-return path. No module-global user cache or automatic post-login mutation was introduced. Later changed server props rebase state; unchanged stale props do not undo a successful event. Detail empty-fitments copy no longer exposes legacy-QA terminology or denies catalogue evidence.

Independent review required two additional regressions: touch-visible compact save failure and context-aware copy when the compatibility panel is already present. Both witnessed RED/GREEN and passed scoped rereview. Compact failure displays Save failed. Try again. within the card image, retains live feedback and does not intercept product links. Detail guidance distinguishes selection needed from evidence already shown.

Final root focused7/7, full264/264 (no failures/skips); lint0errors/3existinglegacywarnings, typecheck0, build0, diff-check0; all14repo validators exit0. Exact code commit, CI and reversible Preview save/removal acceptance follow. Failure cases remain synthetic component evidence; no real provider failure was forced.

### Batch4 acceptance: PASS (scoped engineering and Preview)

Commit346f872629d1c3f97b2eb8cc160e2b1f4ceb7ec6, CI34708517749 success, READY Previewdpl_EmBWhXZrvYjxxb6MgDiptgzbE3gH at second-part-shop-cl4pqr10j-joannakwapis11-5369.vercel.app. Both aliases confirmed through Vercel API on this exact deployment.

Actual QA Buyer: DSG main and Recently viewed copies start false; main Save changes both to true with Part saved. Both remain true after reload (server state). Remove from Recently viewed changes both false; reload preserves false. Previously saved DQ200 remains true in both copies. Original saved state restored. Public detail shows the new no-selection compatibility guidance. Selected-panel and failure/error branches are synthetic render/component evidence; no real failure was induced.

Actual isolated anonymous browser: Save from /?sort=best&fit=0#marketplace leads to /account?returnTo=%2F%3Fsort%3Dbest%26fit%3D0%23marketplace, decoded returnTo exactly /?sort=best&fit=0#marketplace. No auth form submitted or email sent. The anonymous browser was closed. QA Buyer session was then signed out through normal UI after all reversible tests; the QA Seller login is open for the next readonly CSV check, with manual credentials entry pending. No profile, order or sold fixture changed.

Final7focused/264full, lint/typecheck/build/diff-check and14validators PASS; independent scoped rereview has no open findings. Batch5 importer implementation continues; manual login does not block independent code/tests.

## Batch5 local engineering acceptance

CSV imports now require stable seller references, preserving existing seller-scoped case-insensitive uniqueness on retry. Preview/pre-write rejection retains the selected file; confirmed batch writes clear it. Final report update errors or zero affected rows produce explicit recovery with working batch-filtered draft links, without claiming successful final counts. Shared limits consistently enforce 5,000 rows and 20 MiB. No real import, provider failure or database mutation was executed.

Independent semantic review: spec PASS, quality PASS with documented browser reset-order limitation; no actionable code findings. Root focused10/10 and full274/274 pass, no failures/skips; lint0errors/3existing warnings, typecheck and build exit0, diff-check and mobile-performance/launch-baseline/seller-read-policy validators PASS. Synthetic tests cover partial retry, missing references, exact size/row boundaries and finalization recovery. Real React/browser file-reset ordering and readonly seller Preview remain pending QA Seller login, not PASS. Existing RC/external gates remain unchanged.

Batch5 deployment checkpoint: c7cf9266010ac2e3a05dba7f8979332563f247a3 introduced the reviewed implementation. CI34710117945 found a trailing blank line in its new constants file; whitespace-only26de38939923ab505eb05c3cb999fbda931205ab corrected it. CI34710224551 succeeded. READY Preview dpl_EBexrJtHTbbhoUJacdoxr4J7F7Fb at second-part-shop-hcqcye3xr-joannakwapis11-5369.vercel.app matches26de389 exactly; stable alias assigned only after this confirmation. QA Seller browser validation is still pending: current session identifies QA Buyer, so the proper separate seller login was requested without changing Moira. No actual CSV import performed.

## Batch6 local implementation

Source-confirmed header density defects were repaired with one coordinated 1280px desktop/menu boundary, removal of redundant Garage/Seller topbar shortcuts below that boundary (both remain in the menu), and a shrink-safe square brand badge with bounded wordmark. Working desktop navigation, disclosure semantics and mobile Link navigation remain. Root13focused tests and production build passed; agent typecheck/mobile-performance/launch-baseline passed. Independent review and post-deployment actual viewport matrix are pending; class contract tests alone do not prove no visual overlap.
Batch6 final focused13/13, lint exit0 with3 pre-existing legacy warnings, typecheck0, mobile-performance0, launch-baseline0, root build0 and diff-check0. Full-suite run is underway. Both Batch5 aliases were independently confirmed on dpl_EBexrJtHTbbhoUJacdoxr4J7F7Fb.
Batch6 independent semantic/accessibility review PASS; its P3 missing desktop-category breakpoint assertion was added and independently rerun13/13 PASS. Full277/277 PASS before this test-only assertion extension; application unchanged. No open code finding. Actual Preview geometry gate follows.
