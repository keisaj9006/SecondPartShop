# SecondPart Product Excellence Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development, one implementer at a time with independent specification and semantic review. Controller owns Preview, shared checks, commits and deployment.

**Goal:** Improve everyday Buyer/Seller/mobile usability before a grouped Release Candidate round.

**Architecture:** Repair existing Next.js components and routes in small batches. Preserve the supported hosted Android frontend, server authority and completed Marketplace Integrity behavior. No new subsystem, speculative autosave or upload redesign.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, existing Node boundary tests, connected browser.

**Spec:** The user's Product Excellence instructions are the approved scope; the acceptance contracts below make them executable. User explicitly requests immediate implementation after this plan and autonomous continuation. New architecture or business decisions are outside that authorization.

## Global constraints and baseline

- Repository `keisaj9006/SecondPartShop`; branch `rebuild-nextjs` only. Starting HEAD/origin `77b42dc171d976aea86452b18766c818e3960356`, clean and 0/0 on fetch. Never reset to the older code commit.
- Marketplace Integrity Tasks 3–7 are complete. Read their checkpoint; do not repeat their implementation or Stripe E2E.
- Only Preview. No payments/refunds/disputes/reversals/concurrent checkout, real emails, provider outage, destructive account deletion, physical Android/FCM, Production or Stripe Live. Two external DB sessions and 100k load remain RC/external gates, never inferred PASS.
- Preserve RLS, stock reservations, checkout compatibility, truthful fitment/reviews, partial-save recovery, identities and sold QA fixture. Use only the existing unpublished QA Seller fixture for reversible seller checks.
- No real outreach/messages. No assets unless a demonstrated usability need justifies them.
- Every behavioral repair gets an actual component/action or route regression, then focused tests, lint/typecheck and appropriate validators. Full tests/build/14 validators at release checkpoints; CI and exact-SHA Preview/alias/browser checks after push.

## Focused entry audit and priorities

| ID / batch | Evidence at baseline | User impact / priority | Smallest correction | Acceptance and tests |
| --- | --- | --- | --- | --- |
| A11Y-01 / 1 | vehicle-selector.tsx SearchableVehicleSelect derives IDs from changing placeholder, has no accessible name/active descendant, focusable option buttons and no active-option scrolling. Preview confirms null aria-label/activedescendant. | Keyboard/screen-reader selection unreliable; P1 usability | Isolate current combobox; stable instance and value-based option IDs; focus stays on input; explicit keyboard semantics and nearest scrolling | Actual component tests for two instances, filtering/reordering, arrows/Enter/Escape/Tab, empty/disabled/error; Preview keyboard trace |
| A11Y-02 / 1 | globals.css reduced-motion block only disables button transition/press transform, while html smooth scroll and fade-up remain | Unwanted movement; P2 | Target nonessential animation/transition and smooth scroll under reduce; retain perceivable loading text/state | CSS/media assertions and computed-style browser checks where supported; ordinary loading stays visible |
| A11Y-03 / 1 | header-shell.tsx disclosure buttons omit expanded/controls; catalogue errors are plain text | Hidden state and updates not announced; P2 | Add truthful disclosure semantics/live error status; keyboard escape returns to disclosure trigger when focus was inside | Component tests; browser keyboard/focus checks. Do not mislabel in-flow navigation as a modal |
| MOB-01 / 2 | mobile-bottom-nav.tsx schedules warm() twice, each prefetching five routes after every pathname; links also prefetch | Redundant work and possible slow navigation; P2 measured | Measure existing nav logs/call counts before deciding dedup; preserve fast feedback and committed current-page semantics | Same forward/reverse route matrix, actual nav timings, synthetic prefetch count and modified-click/back tests; no fabricated network-request savings |
| HOME-01 / 3 | vehicle-selector.tsx exposes provider configuration / “We do not fabricate vehicle results” in buyer UI | Technical copy obscures useful fallback; P2 | Explain lookup availability and manual selection plainly; reuse existing Home/Garage semantics | Actual render/lookup failure tests, Preview new selection/empty compatible-results comprehension; no fitment logic change |
| BUY-01 / 4 | save-button.tsx ignores result.ok=false and rejected action, with no pending/error/success announcement or aria-pressed | Failed saving appears unresponsive; P1 usability | Preserve action authority; bounded inline feedback and reversible selected-state only on success | Actual component success/failure/rejection/auth redirect tests; reversible existing QA save interaction |
| SELL-02 / 5 | bulk-inventory-import.tsx tells seller to reselect CSV after preview; native action reset loses file; diagnostics mix Valid/created labels | Avoidable rework/confusing import outcome; P2 | Keep file only after non-mutating preview/rejection; clear after real import and display accurate counts. Inspect existing import authority before any retry feature | Synthetic preview→import file retention, successful reset and partial-result tests; Preview-only validation, no real large import |
| VIS-01 / 6 | Responsive review is an evidence gate, not a presumed redesign | Readability and reachable controls; P2 if reproduced | Inspect 390×844, 768×1024, 1280×800, 390×480 and enlarged text; fix only documented overflow, clipped controls, contrast/spacing defects | Before/after screenshots or DOM bounds, meaningful style/component regressions; preserve assets and content |
| SEO-01 / 7 | root layout defines one generic title/description; no route metadata/OG/JSON-LD/canonical/robots implementation found | Unclear page identity/sharing; Preview protection should not depend solely on hosting; P2 | Safe route titles/descriptions and Preview noindex; truthful public Product/Offer/Breadcrumb only when supported; canonical omitted until approved production origin | Metadata/serialization tests against synthetic public data, private/absent listing cases, unsafe JSON escaping and Preview HTTP/meta checks; no invented origin or ratings |

Journey audit may add concrete findings within these batches before dispatch, recording evidence and the narrow contract here. A batch with no additional defect receives verification evidence, not cosmetic edits.

Focused journey audit additions (source-confirmed at baseline):

| ID / batch | Evidence | Impact / priority | Repair and proof |
| --- | --- | --- | --- |
| HOME-02 / 3 | vehicle-selector.tsx single-variant registration path leaves manual panel closed; multiple unmatched engines leave canApply false | Successful lookup cannot be applied; P1 | Reveal required engine/fuel choice without inventing one. Synthetic actual-component single-variant/two-engine regression and single-engine control case; no real lookup provider activation |
| BUY-02 / 4 | SaveButton authRequired sends every item to /saved although no save occurred | Buyer loses selected item; P2 | Return to safe current page/search context with clear sign-in/save-again intent; reuse existing sanitizer. Component card/detail redirect tests; no real email |
| SELL-03 / 5 | inventory-csv-import.ts permits null seller_reference, generating a new slug every retry; uniqueness only covers non-null reference | Partial retry duplicates already-created drafts; P1 | Require stable seller_reference for each importable row, including preview validation, reusing existing seller-scoped casefold uniqueness. Missing-reference rows never write; retry referenced partial file cannot duplicate earlier success. Do not invent identity from title or silently update inventory |
| SELL-04 / 5 | final seller_inventory_imports.update error is ignored after row writes | UI claims success but durable report can remain failed/zero; P1 | Return explicit incomplete-report recovery with batch ID on finalization error, keep imported-draft access and prevent stale-file automatic replay. Synthetic failure test; no induced database/provider outage |
| SELL-05 / 5 | UI says 2000 rows/8MB; importer and validator enforce 5000 rows/20MiB and oversize error still says8MB | Contradictory seller guidance; P2 | Shared limit constants and exact UI/error guidance; boundary tests at5000/5001 and20MiB |

Preview HTTP observation: public product response has the generic title, no JSON-LD, no robots meta and no X-Robots-Tag. Implement explicit nonproduction noindex in Task7; do not assume the stable alias inherits hosting protection. Actual390px screenshot confirms VIS-01 topbar search icon overlaps the brand for a buyer with seller access.

## Task 1: Accessible vehicle selection and motion

**Files:** Extract `src/components/searchable-vehicle-select.tsx` from vehicle-selector.tsx if needed for focused testing; update caller labels. Modify globals.css and header-shell.tsx only for the stated access defects. Tests `scripts/test-vehicle-select-accessibility.mjs`, `scripts/test-reduced-motion.mjs` and focused header coverage.

**Interface:** Preserve value/options/placeholder/disabled/onChange; add an explicit stable label (Make/Model). Option values remain unchanged and onChange fires only for a deliberate click or Enter on an active available option. No provider call or selected-vehicle URL contract changes.

- [x] Write RED tests at the actual component boundary. Assert active descendant points to a rendered option, distinct IDs across instances, stable value IDs after filtering, option tabIndex=-1, accessible Make/Model names, no onChange for arrows/Escape/Tab/empty Enter.
- [x] Implement input-focused combobox: arrows open/navigate available options without accidental selection; Escape clears draft/closes; Tab closes without preventing natural focus movement; empty results have no active descendant; disabling or failed/empty data cannot leave an actionable stale option. Scroll the active option with `block:'nearest', behavior:'instant'` (or equivalent nonanimated behavior) only when needed.
- [x] Preserve visible focus and mouse selection. Add status semantics to empty/error catalogue feedback and accurate header disclosure expanded/controls without introducing a modal trap for in-flow menus.
- [x] Reduced motion: `html{scroll-behavior:auto}` under reduce; `.animate-in` no fade/translation; suppress nonessential transitions/press movement. Do not remove static rotation that conveys open/closed state. Keep loading text and necessary loading indicators perceivable.
- [x] Run red/green focused tests, lint, typecheck, mobile-performance and launch-baseline validators. Independent review and actual Preview keyboard/axe acceptance passed; see evidence report for commits and limitations.

## Task 2: Measured mobile navigation

**Files:** mobile-bottom-nav.tsx; root-tab-loading.tsx and existing five loading.tsx boundaries only where measurement shows a gap; focused `scripts/test-mobile-navigation.mjs`.

- [x] Capture baseline real app nav logs for Home→Garage→Purchases→Inbox→Account and reverse; browser Back and scroll checks. Record viewport, warm/cold distinction and measurement limitations. Count component prefetch invocations separately from network requests.
- [x] Reproduce redundant warming and modified-click/pending semantics in component tests. Keep committed aria-current separate from visual pending state; modified clicks must not mark current tab pending.
- [x] If duplicate warming offers no evidenced benefit, use one bounded warming mechanism, no repetitive per-route double loop. Keep intent feedback and existing Link routing/Back; do not force reload or revive legacy shell.
- [x] Check skeleton geometry/status announcements before altering loading UI. Compare the same route matrix after the fix; report measured values even if latency improvement is inconclusive. Run tests/lint/typecheck/mobile validator and independent review.

## Task 3: Home/Garage clarity

**Files:** vehicle-selector.tsx, Garage page, compatibility-badge.tsx and part-request-card.tsx only as warranted by the focused audit.

- [x] Inspect fresh selection, saved Garage selection, enabled/disabled fit filter, removal/reload and no-compatible-offer fallback on Preview; record existing correct behavior without reimplementing it.
- [x] Replace confirmed technical-only user copy with actionable availability/manual-selection explanation. Preserve confirmed/family/unknown evidence labels and request context. Add render regressions for changed copy/error states.
- [x] For one resolved variant with multiple unmatched engines, expose the missing engine/fuel choice and explain it; keep apply disabled until selected. Tests must prove no inferred engine and unchanged automatic single-engine resolution.
- [x] Verify no checkout/server compatibility changes, focused tests/lint/typecheck and review.

## Task 4: Buyer feedback

**Files:** save-button.tsx and focused `scripts/test-save-button-feedback.mjs`; additional concrete journey findings separately scoped before changes.

- [x] Test success, ok=false, thrown action, authRequired, pending and repeated activation using actual component handlers.
- [x] Expose pressed/busy and compact accessible pending/success/error status; preserve original selected state on failure and successful action authority. Signed-out save returns to the exact safe originating page to retry, rather than an empty /saved destination. No invented optimistic persistence or post-auth automatic write.
- [x] Walk search→card→detail→seller/fit→saved/recent→Find My Part→account→existing purchases without checkout. Verify reversible QA actions and meaningful empty/error states, then focused checks/review.

## Task 5: Seller preparation

**Files:** bulk-inventory-import.tsx, existing import actions/data validation and listing form only for demonstrated additional issues; focused import/form regressions.

- [x] Read import preview/draft creation, seller-reference uniqueness and report limits; distinguish replay-safe existing references from rows without references. Do not claim universal idempotency.
- [x] Require a nonempty stable seller_reference for each importable CSV row and explain reuse for retries; reject missing references before writes. Existing casefold uniqueness remains authoritative; reject duplicates without overwriting existing stock. Tests prove repeated missing-reference file writes zero and a referenced partial retry creates only remaining rows.
- [ ] Reproduce preview file reset; retain selection only where no rows were written and keep deliberate success reset. Accurate valid/created/rejected counts and actionable report guidance; do not allow replay after partial writes or invent upload atomicity.
- [x] Check final batch update errors explicitly; expose incomplete-report recovery/batch link instead of success. Synchronize UI and importer limit constants at existing5000rows/20MiB without increasing limits. Test failed finalization and exact size/row boundaries synthetically.
- [ ] Inspect errors, correction of rejected rows and existing inventory/report UI. Run only synthetic import action tests and safe Preview validation on QA Seller; no new public fixture or bulk mutation.
- [x] Verify existing partial-save recovery/publication rules remain, run focused checks/review.

## Task 6: Responsive consistency

- [ ] Capture representative Home, Garage, product, account and seller form at the five specified viewport/text conditions. Record actual clipped/overlapping control, horizontal overflow or contrast defect before editing.
- [x] Apply the smallest shared style or local layout fix per confirmed defect; prefer readable text, reachable CTA and visible focus. Do not add decorative assets.
- [x] Add regression coverage for changed behavior/layout contract; repeat affected viewports, tests/lint/typecheck/review. Corrected authenticated desktop/mobile and anonymous desktop checks passed on1a34457. Real physical device/screen reader execution remains RC; the seller-form matrix still requires QA Seller login.

## Task 7: Safe metadata and SEO preparation

- [x] Inspect public route data and production-origin helper. Document canonical/landing decisions requiring actual domain/business input as blocked.
- [x] Add route-appropriate metadata without duplicate expensive fetches. Set Preview/nonproduction noindex; use no fake canonical. Private account/seller workspace metadata must not leak personal data.
- [x] If data supports it, render safe public Product/Offer/Breadcrumb JSON-LD with exact price/currency/status and existing images; omit unsupported brand/ratings/availability claims. Escape `<` in serialized JSON. No autogenerated empty landing pages.
- [x] Test synthetic metadata/structured data and deployment robots/meta behavior. Full301 tests/build/14 validators, final independent integration review plus F1–F3 rereview, CI/Preview/alias verification passed on1a34457; see the evidence report. Domain-dependent publication remains blocked.

## Checkpoint protocol

Each task records code commit, focused/full checks, independent review, actual Preview observations and honest limits in `docs/test-runs/2026-09-12-product-excellence.md`. Keep prior evidence intact. When session size requires a boundary, finish/push the current verified batch and leave an exact first-unfinished-task checkpoint; do not restart this audit.

### SEO decision boundary for Task7

No production origin is approved by this phase. Preview must explicitly remain noindex; canonical URLs, URL-dependent Breadcrumb data and a production sitemap are blocked until the approved origin passes the existing HTTPS/non-preview requirements. No provider or auth URL configuration changes are part of SEO work. Request-scoped metadata reads must not create a cross-user data cache.

Future category/make/model/OEM landing pages should be selected from real stocked inventory and meaningful buyer demand, with distinct useful descriptions, correct compatibility explanations and navigable active offers. Empty categories, synthetic compatibility and mass combinations are excluded. This phase documents that strategy; it does not publish landing pages or infer business prioritization from a handful of QA listings.
