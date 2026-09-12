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
