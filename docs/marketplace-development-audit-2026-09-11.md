# Marketplace development audit — 11 September 2026

Baseline: `72f9fdc1dab9c4b407056aca74af1a68791cb675`, `rebuild-nextjs`. This is an evidence-based development backlog, not a launch sign-off. The active phase is incremental marketplace hardening under the user's 11 September instruction; working payment architecture and approved product policies remain intact.

## Environment and established checkpoint

- GitHub read, Vercel read, Supabase read and the connected browser all worked at phase entry. No reauthentication was needed.
- Local working tree was clean; origin branch and HEAD matched. CI `34645810688` succeeded.
- Stable Preview resolved to READY `dpl_8GrzX6W4XZ2kDcNCJACjqbtvBF3F`, same SHA; both stable and branch aliases had been verified in the preceding checkpoint.
- Supabase `etkupijfdznljimrfyct`: 185 recorded migrations, latest recorded version `20260911084129`. Local and applied migration version labels differ and some local labels collide. Do not replay or repair history wholesale.
- The documented £12.50 Stripe test purchase completed through webhook, fulfilment, receipt, explicit acceptance and a single Connect transfer. Actual webhook replay and authenticated payout-endpoint repetition did not duplicate it. See `test-runs/2026-09-11-commerce-preview-preflight.md`.
- This phase does not repeat full Stripe purchases for unrelated catalogue/UI work. No DVSA credentials/provider will be enabled.

## What already works, and what is not yet proven

| Area | Existing implementation/evidence | Remaining limit |
| --- | --- | --- |
| Buyer access | Public browse; authenticated actions; sellers can buy; own listings excluded; safe internal auth redirects | Signup and zero-result auth lose return context; navigation defects below |
| Vehicle/Garage | Catalogue/manual fallback; `addVehicle=1` suppresses previous Garage selection; abortable catalogue requests | Remove-chip persistence, Back/Forward state and keyboard combobox issues |
| Fitment | Distinct confirmed/family/unknown evidence, transaction-backed valid-feedback view, server checkout checks | Two newer listing RPCs bypass the valid-feedback view |
| Commerce | Provider-only paid/release RPC grants freshly verified; protected reservation; real Scenario A passed | Refund/dispute/reversal, stock-one concurrency and decline/retry provider batches remain separate unsigned gates |
| Seller operations | Ownership checks, draft-first publication, image signature/size checks, CSV drafts, casefold inventory reference uniqueness, bounded import batches | Reserved image-byte deletion loophole; validation resets listing input |
| Scale | Keyset browse, database filters and distance RPCs; compressed uploads and thumbnails | Search sorting/filter candidate limits, mobile cursor integration; no 100k-record load proof |
| Android | Supported Capacitor wrapper loads hosted Next.js; signing/package/app-link gates exist; legacy shell is not the production UI | Physical RC/FCM evidence and external release configuration deferred to grouped QA |
| SEO/growth | Find My Part, saved searches, seller leads, Founding Seller and bulk-import foundations exist | Product metadata/canonical/structured data and crawlable landing strategy need deliberate work; real supply remains sparse |
| Operations/security | Server-side auth verification, no bearer token trust without Supabase validation, no private-response service-worker caching | Leaked-password protection disabled; monitoring configuration and log redaction need review |

Supabase advisor at audit time: no ERROR-level findings; WARN groups include 16 anonymous and 62 authenticated SECURITY DEFINER functions plus disabled leaked-password protection. Public catalogue RPCs and guarded authenticated RPCs are intentional; warning counts alone are not vulnerabilities. Fresh grants confirm `confirm_checkout_paid`, `cancel_checkout_order`, payout claim/release and rollback finalization are service-role-only. Eight private tables intentionally have RLS and no client policies. Performance advisor reports 104 unused-index notices on a tiny dataset: this is not evidence to remove scale-critical indexes.

References: [SECURITY DEFINER review guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Prioritized backlog

Costs are approximate engineering effort for implementation and focused verification, excluding external waits. Statuses will be updated per verified batch. P0 release blockers are distinguished from newly reproduced application defects.

| ID / priority | Problem and impact | Code/live evidence | Smallest proposed remedy | Risk | Dependencies | Cost | Completion criterion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-01 / P1 | Seller can remove/overwrite reserved listing image bytes, corrupting purchase evidence | `dashboard/actions.ts` deleteListingImage; mobile seller photos DELETE; live Storage delete/update policies authorize own folder without reference check | Serialize metadata deletion against parent reservation; delete metadata before Storage cleanup; forbid mutation of referenced Storage objects | Medium, cross-service cleanup and legacy clients | Backward-compatible policy/trigger migration, isolated regression fixtures | 1–2 days | Reserved/last-active image rejected before Storage call; direct referenced-object mutation denied; valid draft deletion works |
| FIT-01 / P1 | Refunded/disputed transactions can still contribute buyer_verified in browse/nearest | `20260909202000` catalogue cursor and `20260909203500` catalogue distance V2 query raw verified_fit_feedback; earlier `20260907163500` uses private.valid_verified_fit_feedback | Reuse the existing valid-feedback view in both newer RPCs, preserve signatures/ranking | Medium, purchase confidence | Definition comparison and non-destructive migration | 0.5–1 day | Browse, nearest, sorted and detail all use valid completed transaction evidence |
| NAV-01 / P1 | Changed filters inherit old cursor/page; valid results can be skipped | marketplace-search pushParams, header-shell selectCategory, compatibility toggle | Shared reset of both pagination parameters when filter meaning changes | Low | None | 0.5 day | Query/category/fit changes start first page; unrelated context retained |
| API-01 / P1 | Mobile catalogue cannot advance through new keyset results | Mobile marketplace route ignores cursor while data layer now expects it | Forward cursor and expose nextCursor, preserve offset paths where supported | Low | Contract tests | 0.5 day | Second request advances, no repeated first page; web unaffected |
| SEARCH-01 / P1 | Text search ignores selected global price/delivery/warranty order | marketplace data search path selects relevance page without requested sort; unused client helper is not called | Apply requested order in database before page boundary | Medium | SQL performance/contract checks | 1–2 days | Matches spanning >1 page respect global requested order |
| SEARCH-02 / P1 | First 500 text candidates are filtered later; relevant inventory disappears at scale | Search candidate limit precedes category/price/fit filters | Push full filter semantics into bounded query/RPC; avoid fetching 100k IDs | Medium | SEARCH-01, realistic isolated dataset | 2–4 days | Selective match beyond old cap remains discoverable; bounded payload/query plan |
| NAV-02 / P1 | Removed vehicle returns after reload; URL Back can show stale inputs | MarketplaceSearch chip omits persistence clearing; one-time query state; incomplete vehicle key | One explicit clear operation, committed URL state synchronization, complete vehicle identity key | Low | NAV-01 | 0.5–1 day | Both removal controls persist; Back/Forward controls agree with results |
| AUTH-01 / P1 | Buyer loses selected product or Find My Part intent during signup/login | auth/actions signup ignores returnTo; part-request-card hardcodes return to Home | Preserve sanitized internal return URL in immediate and email signup paths and request CTA | Low | Redirect regression tests | 0.5–1 day | Product/query/category/vehicle context survives auth; unsafe URLs rejected |
| SELL-01 / P1 | Server validation clears entered price/options/files and creates inconsistent form state | Actual Preview rejected-listing test; ListingForm uses resolved action with native reset | Preserve form inputs on rejected listing submission; successful redirect remains unchanged | Low | Form/browser regression | 0.5 day | Validation error retains editable fields and chosen photos; retry succeeds normally |
| A11Y-01 / P2 | Keyboard vehicle option not exposed or scrolled into view | SearchableVehicleSelect lacks active descendant and option IDs | Stable IDs, accessible label, active option scrolling | Low | UI semantics tests | 0.5–1 day | Arrow/Enter/Escape behavior and screen-reader state agree |
| A11Y-02 / P2 | Reduced motion still runs page entrance animation and smooth scroll | globals.css reduced-motion block covers button transforms only | Disable entrance animation and smooth scrolling for preference | Low | CSS regression/browser inspection | 0.25 day | Reduced-motion preference removes nonessential movement |
| OPS-01 / P1 | Privacy sanitizer does not cover all provider-secret formats | ops-monitoring sanitizer handles sk/pk/rk/Bearer, not signing secrets | Add bounded explicit redaction patterns and adversarial unit cases | Low | Existing logging contract | 0.5 day | Signing secrets, standalone auth tokens and payment client secrets are removed without losing safe IDs/statuses |
| DOC-01 / P2 | Canonical/context documents contradict completed implementation and each other | pre-payments roadmap still says checkout missing/403; older product decisions describe deferred payments | Mark historical material explicitly and reconcile current pointers | Low | Current runbooks and provider evidence | 0.5 day | No current instruction restarts onboarding/payments; source hierarchy clear |
| QA-01 / P0 release gate | Return/refund/dispute/reversal, concurrency and decline-retry not yet provider-proven | commerce runbook/checklist; Scenario A evidence is bounded | Execute existing runbook in separate configured test batches | Medium | Admin/disposable QA identities; two buyer sessions for race | 2–4 days plus waits | API, DB, inventory, event and idempotency evidence for each scenario |
| AUTH-02 / P0 release gate | Leaked-password protection remains disabled | Fresh Supabase security advisor | Enable after confirming applicable plan and Auth setting access; verify | Low | External/project Auth configuration | 0.25 day plus access | Advisor clears and account flows remain valid |
| SCALE-01 / P2 | 100k-listing throughput/Web Vitals not established by six listings or static validators | Current evidence is structural/functional, not load or field telemetry | Isolated synthetic workload, query plans and route/bundle measurements | Low to production when isolated | Dedicated load-test dataset/environment | 2–4 days | Recorded latency/payload/query plans under representative load |
| SEO-01 / P2 | Generic metadata and no confirmed product schema/canonical strategy | App layout metadata; no generateMetadata/structured-data routes found | Approved minimal metadata/crawl design, then category/vehicle/OEM landings only with useful inventory | Low/medium | Canonical production origin/business copy decision | 2–4 days | Correct share/search previews, valid structured data, no Preview indexing |
| SUPPLY-01 / P1 business | Engineering exceeds real inventory and seller liquidity | Launch supply gates remain unsigned | Existing Founding Seller/import tools plus real seller onboarding and demand measurement | Business | Real professional sellers; outreach authorization | Ongoing | Genuine inventory, response and fulfilment metrics; no fabricated reviews |
| RELEASE-01 / P0 release gate | Production/Android/legal configuration and physical evidence incomplete | launch-readiness and Android runbooks | Group external setup and device QA at RC; preserve wrapper | External | Domain, signing, Play, Firebase, legal/support ownership | 3–6 days engineering plus external waits | Signed release evidence, real device/FCM results, legal/support approval |
| LATER-01 / P3 | Richer waves, feed sync, Buy + Fit expansion and content are opportunities, not current defects | Research targets and existing foundations | Separate designs justified by supply/demand evidence | Medium | Business decisions, providers | Separate estimates | Approved scope and measurable value before implementation |

## Execution sequence and proof standard

1. SEC-01 and FIT-01 protect existing evidence/invariants. Build regression checks before changing implementation; inspect applied definitions before additive/replacement DDL. Do not bulk-repair migration history.
2. NAV-01/API-01/NAV-02/AUTH-01 fix core discovery and return paths in independent, small commits. No new checkout transaction is needed.
3. SELL-01, OPS-01, accessibility and search ordering/filter bounds follow their proven failure cases. Measure query shape before optimizing.
4. Complete wider Preview checks and documentation reconciliation, then progress remaining independent backlog items. Product expansions needing design or external setup stay explicitly blocked while other work continues.

Each code batch: red regression → minimal fix → focused tests → lint/typecheck/diff check → review → commit/push rebuild-nextjs → CI. Full build and the relevant safety validators are run at subsystem boundaries; full suite/build at broader checkpoints. Preview is accepted only when READY and matching current SHA. No main/Production/Stripe Live operations.

## Manual QA deferred to RC

See `manual-qa-marketplace-rc.md`. Deferral is not a substitute for automated tests and browser verification. Current unknowns include physical low-end-device timings, screen-reader/device interaction, production email deliverability, real network interruption, physical delivery/support operations, provider failure scenarios, and field performance.

## Working checkpoint

FIT-01 implemented and applied to Preview: both newer catalogue RPCs now read the canonical transaction-backed evidence view. Independent review approved; 23 batch tests, lint, sequential typecheck, build and 14 validators pass. See `test-runs/2026-09-11-verified-fit-catalogue.md` for migration mapping, SQL readback and honest limits. Commit/CI publication follows this checkpoint.

Published FIT-01 checkpoint: commit `085d9b9381ebd2da6c68298d100b3ceba122a385`; GitHub Actions run `34650136088` succeeded; Preview deployment `dpl_831zFhpHrQCJQ8e6GnhGbKHBper5` (`second-part-shop-dq5cwur8b-joannakwapis11-5369.vercel.app`) is READY. Both stable and branch Preview aliases were read back and point to that deployment. No Production/main/Stripe Live changes.

SEC-01 is in implementation, with red action tests reproducing unsafe Storage calls on reserved/failed/zero-row metadata deletions. No photo policy migration has been applied yet.

Two navigation defects were reproduced in the browser on baseline Preview: changing `q=alternator&page=4` to `DSG` retained page 4 despite three matches, and clearing the vehicle chip followed by reload restored the removed vehicle from localStorage. These are next-batch regression scenarios. No launch completion is claimed.

DOC-01 reconciled: README and the historical pre-payments roadmap now identify completed commerce correctly; current product decisions explicitly prohibit payout based on silence alone and label the old proposal superseded. The earlier filename-collision hypothesis was rejected after inspecting the actual paths (underscore versus hyphen); no rename or content loss occurred. Independent documentation review approved the corrected README sequence and verified referenced paths.
