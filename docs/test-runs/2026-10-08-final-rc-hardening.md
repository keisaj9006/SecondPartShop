# Final RC hardening — 8 October 2026

Status: VERIFIED RC REPAIRS / EXTERNAL RELEASE GATES. The reviewed RC26 defect register now has zero known P0 and zero known P1 defects. The deployed five-function repair passed 32/32 safe hosted rollback scenarios and 67/67 isolated PostgreSQL 17 tests using exact freshly exported hosted definitions, with independent review. Normal mailbox/Auth/Storage deletion, provider and physical-device acceptance remain separate release gates.

## Remaining automation continuation — 8 October 2026

The owner requested all safe automation before manual QA. Fresh coverage found a new P1, RC26-09: sold-part public RLS hid the part join and silently removed ongoing buyer cases. The caller-authorized page now resolves only missing purchased-part title/slug, with explicit relationship checks and unavailable-data errors. Thirteen actual-handler regressions pass. Saved-search read mapping now preserves fit intent; native dot-segment completion, App Links fingerprint formats and ignored-webhook push scheduling are also repaired. Independent affected-change review passed 95 tests. Final local suite passed 1,225 tests; lint has zero errors/four existing warnings, typecheck/build, all 14 validators and production dependency audit pass. Exact integrated CI passes all seven jobs and 1,246 tests; Preview HTTP checks pass 45/45. [The continuation checkpoint](2026-10-08-remaining-rc-checkpoint.md) records exact code SHA, deployments and final severity.

See [Auth/browser/integration](2026-10-08-remaining-auth-browser-integration.md), [product journey coverage](2026-10-08-remaining-product-automation.md), [independent security/performance review](2026-10-08-remaining-security-performance.md), and [compact owner confirmation pack](2026-10-08-compact-owner-pack.md). Adapter/provider/artifact evidence is distinguished from hosted persistence and physical-device acceptance. No destructive shared-host package or global privacy worker was executed.
## Verified starting state and scope

- Original checkout: detached `66b94bf6d1c9b160dacf9e312925a9c1cd2d3c6c` with unrelated dirty changes, preserved untouched.
- PR [#16](https://github.com/keisaj9006/SecondPartShop/pull/16) open/unmerged, `codex/auth-hardening` at `0c3860dfafabbd22811d7b633d3702543dcfa3b4`, targeting `codex/dvsa-integration`. PR [#10](https://github.com/keisaj9006/SecondPartShop/pull/10) open/unmerged at `387fd8045d0a8a643b5fe393fa126e9f978eb192`, targeting `rebuild-nextjs`. Both merge gates stay held.
- Isolated managed worktree on `codex/final-rc-hardening` starts at that exact auth HEAD.
- Baseline Preview `dpl_DYso5Ac8QJG2qUaQyqZKwoUymRcJ`, READY, https://second-part-shop-ciz11l759-joannakwapis11-5369.vercel.app; GitHub Vercel success is correlated with the exact auth SHA.
- Supabase `secondpart` / `etkupijfdznljimrfyct`, eu-west-2, ACTIVE_HEALTHY, PostgreSQL 17.6.1.166. Preview mapping follows owner-confirmed current runbooks. Health says `backendReady=true` (configuration presence, not an exhaustive backend transaction check).
- Hosted ledger: 206 entries through `20261006093220`. Historical ledger drift remains; no reconciliation, arbitrary db push or hosted DDL performed.
- Connected Stripe account: SecondPart sandbox, `livemode=false`. Preview secret-key/webhook variable names exist; values were not decrypted, so connector mode is not independent proof of the deployment key's value.
- Shared Preview variable inventory includes Supabase, DVSA, Stripe and OPS alert inputs. `CRON_SECRET` is restricted to `rebuild-nextjs`; Firebase server credential and `PUSH_DISPATCH_SECRET` are absent from the listed Preview inventory. No variable values/settings changed.
- No main change, PR merge, Production deployment, Stripe Live operation, Play submission, owner-account deletion or hosted fixture mutation.

## Defect register

| ID | Severity | Reproduction and disposition |
| --- | --- | --- |
| RC26-01 | P1 | Invalid/unavailable explicit fit-ON catalogue or Garage context silently queried broad Home results; client canonicalization could remove error context. Behavioral RED 9; fixed in `0504546`. |
| RC26-02 | P1 | Equivalent no-keyword mobile marketplace API request returned unfiltered 200. Behavioral RED 8; fixed in `0504546`. |
| RC26-03 | P2 | Saved-search web allowlist dropped `fit=0/1`, changing intent when reopened. RED 2; fixed in `0504546`. |
| RC26-04 | P1 | Hosted native mode ignored supported HTTPS completion App Links on warm/cold launch. RED 10; narrow same-origin completion routing fixed in `62362de` with regression and final CI verification. |
| RC26-05 | P1 | Cookie-free mobile-auth return URLs falsely displayed Email confirmed / Password updated. Reproduced on real Preview and page harness; RED 7; provider-backed email status and neutral password-return copy fixed in `ee3aa86`. Actual new Preview confirms neither false success appears. |
| RC26-06 | P0 checkout + P1 fitting — FIXED / VERIFIED | Creation and deletion claim now serialize account authority. Exact deployed bodies passed seven real PG17 overlap schedules, attached-buyer/stock/retry assertions, and safe hosted deletion-state rejection scenarios. No shared committed race fixtures or cleanup were executed. |
| RC26-07 | P1 | Hosted Android never loads the legacy push adapter or exposes registration, and native Header removal makes existing logout unreachable. Fixed in `62362de`: direct injected plugin listeners, explicit Account opt-in/disable and logout, signed installation binding, disabled staging/CAS activation and coordinated native auth returns. Review caught and repaired stale-account, callback, stage-overwrite and overlapping account-change races before deployment. |
| RC26-08 | Two P1 authorization defects — FIXED / VERIFIED | NULL-owner response and detached-participant message comparisons fail closed. Actual hosted rollback checks deny strangers while retaining buyer, owner, surviving-participant and designed administrator authority; exact-body isolated regressions also pass. |

The SQL candidate and [rollout/preflight evidence](2026-10-08-deletion-checkout-race.md) remain outside migrations. It preserves current grants and RLS and replaces only five named functions. Before application, all seven captured hosted bodies matched their checked-in bases; after application, all five replacement bodies match the approved repair, while the two control functions are unchanged. Same-day counters found zero detached active-order buyers, zero detached active-fitting buyers, zero requests with detached garage owners, and zero deletion requests processing; this is a point-in-time exposure check, not proof of historical absence.

## Coverage and honest boundaries

| Area | Executed evidence | Remaining boundary |
| --- | --- | --- |
| Auth/accounts/roles | Actual anonymous Account and buyer/seller selector; no false outage. Focused auth/session/profile/return tests; real Preview mobile false-success negative checks. | Fresh external mailbox, delivered used/expired links, real password reset/login credentials and profile lifecycle are unsigned. |
| Buyer / Garage / compatibility | 76 focused actual Home/API/persistence/saved-search cases, invalid/null/provider failures, fit ON/OFF and ownership/context transitions. Actual browse -> quantity-one part -> sign-in preserves intended part URL and sort. | Authenticated save/remove/current-vehicle switch, live owner-known DVSA derivative, orders and reviews need disposable authenticated sessions. |
| Search / product | Six public listings render; quantity-one product exposes stock, provenance, explicit fit evidence and Sign in to buy, without inventing a fit guarantee. Plain search responds. Isolated scale checks below. | No provider-backed purchase inferred from read-only browse. |
| Seller / CSV / images | Full suite covers existing seller role policy, malformed/5,000-row CSV/price/transport and image decode, dimensions and MIME rejection behavior. | Fresh signed-in listing/import/Storage lifecycle is unsigned without configured disposable fixtures. |
| Commerce / cases / reviews / messages | 196 focused local commerce/security tests plus isolated real PG17 stock, dispute-reversal and evidence concurrency. No new provider transaction executed. | Adverse Stripe browser flows, replay/dispute/transfer recovery and fresh authenticated cross-role execution remain distinct provider gates. |
| Security / RLS | Twelve cookie-free private mobile endpoints return 401, unauthorized, no-store. All public base tables have RLS enabled. Retained-fitting authorization bugs reproduced and proposal tested. | Hosted rollback authorization acceptance passed. Advisor warnings and account/provider configuration remain explicit. |
| Account deletion | Exact worker/SQL reproduction; 56/56 local proposal tests and 63/63 real PG17 cases including seven overlapping schedules. | Hosted preflight/application/readback and safe rollback acceptance passed; exact deployed-body PG17 concurrency passed. Normal Auth + Storage destructive E2E and retention sign-off remain separate. |
| Responsive / accessibility | Signup DOM has no horizontal overflow at measured 320, 360, 390, 430, 768, 1024, 1280 and 1440 widths, height 480. Named controls and buyer/seller selection inspected. | This is a measured page sample, not every screen, screen-reader or physical keyboard/device sign-off. Browser automation had intermittent timeouts. |
| Android / Play | 44-scenario static validator; HTTPS completion regression; native push/identity repair independently reviewed; [Android dry run](https://github.com/keisaj9006/SecondPartShop/actions/runs/37775293390) passed on `d017345`. | Actual signed device/test track, camera/gallery, app-link returns, FCM delivery and submitted AAB remain owner gates. |

## Security and performance evidence

Read-only Supabase security advisors: 11 INFO RLS no-policy internal tables (deny by default), 16 anonymous and 68 authenticated SECURITY DEFINER warnings requiring intentional ownership/authorization inspection, and disabled leaked-password protection. No blanket grant revocation or RLS weakening. Free-to-Pro+ leaked-password configuration remains a provider/owner gate. RC26-06/08 are now independently verified fixed; these broader configuration/advisor findings still prevent an unconditional security or launch sign-off.

Read-only performance advisor reports 66 unused-index INFO findings. Small QA statistics do not justify index deletion. Secret-format scan inspected 936 tracked files and 53 local client bundles; the only match was the explicitly synthetic nonfunctional Supabase key in the monitoring-redaction test. No real secret or private key match appeared; this scan is not proof against every possible secret format.

[Machine-readable isolated scale results](2026-10-08-marketplace-scale.json) preserve fixture, runtime, SQL hash, exact query order and timings. Six queries per size verify compact OEM matching, bounded pages, global order, deep pagination and terminal pages. No shared database writes.

| Listings | Runtime | Query range | Result |
| --- | --- | --- | --- |
| 1,000 | Local PGlite / PostgreSQL 18 | 118.9–223.2 ms | PASS |
| 10,000 | Local PGlite / PostgreSQL 18 | 103.9–360.4 ms | PASS |
| 25,000 | Local PGlite / PostgreSQL 18 | 162.8–701.4 ms | PASS |
| 100,000 | CI PostgreSQL 17 | Current baseline 122.4–864.3 ms; isolated existing single-scan patch 98.2–567.6 ms | PASS |

These are single-run synthetic measurements on different hardware, not hosted latency percentiles or a public production SLO. The existing CI diagnostic candidate does not change the hosted search function.

## Verification checkpoints

- First suite overlapped source edits: 882 tests, 870 passed / 12 failed. It was not a clean baseline. Root cause: temporarily loosened malformed-keyword semantics plus old invalid-input fixture. Restored existing keyword validation and corrected only invalid no-keyword behavior.
- Clean early integrated checkpoint: 941/941, no failures/skips. Lint: no errors, four unchanged warnings; typecheck and production build passed. All 14 explicitly inspected local static validators passed. These source/runbook validators do not execute destructive/provider E2E.
- Current committed checkpoint `d0173456cadd6b8aa54b4a1cdfffa813cdf95053`: [QA run 37775219015](https://github.com/keisaj9006/SecondPartShop/actions/runs/37775219015) PASS, all seven jobs, 972/972 full tests; deletion PG17 63/63 including actual advisory waits and reciprocal fitting lock order. Garage identity, last stock, marketplace scale, dispute reversal and case evidence concurrency all passed.
- Production dependency audit: zero vulnerabilities. Final frozen source: **1,026/1,026 passed**, no failures/skips; lint zero errors/four unchanged warnings, standalone typecheck and production build passed. The three affected native validators were rerun after final edits. Final 55 client JavaScript chunks contain no service-role, Firebase credential or HMAC signing-code markers.
- Automatic approval review rejected a broad dynamic validate-all loop; after import/operation inspection, the explicit 14 local validators were approved and passed. No blocked or dangerous flow was substituted.
- Independent review found and cleared the five-function SQL proposal, including real ACL preservation and the missing reciprocal fixture identity. Final push/AppLinks/auth/reset/Account independent review passed 104/104, including 40 push cases, with no remaining actionable P0/P1 in the scoped candidate. No hosted DDL approval is implied by code review.

Checkpoint Preview for `d0173456cadd6b8aa54b4a1cdfffa813cdf95053`: https://second-part-shop-em54w61m6-joannakwapis11-5369.vercel.app, Vercel deployment `dpl_BqyvSYP34aJaSzYwrHgnixv37Trm`, GitHub deployment 6935165819, environment Preview, READY/success. Cookie-free Home/Account/Garage/Dashboard/search and actual `/api/mobile/v1/health` respond 200; backendReady true. Auth mobile false-success probes are negative. An initial `/api/health` probe was the wrong endpoint and was corrected, not treated as a backend failure.

## Final code verification and Preview

- Code commit: `62362de62b7556458f445137eccd970cd1678fc5`, branch `codex/final-rc-hardening`; [draft PR #17](https://github.com/keisaj9006/SecondPartShop/pull/17) targets the still-unmerged auth branch.
- [QA run 37777899700](https://github.com/keisaj9006/SecondPartShop/actions/runs/37777899700): all seven jobs PASS, full suite 1,026/1,026; PG17 deletion/fitting 63/63, including seven contention schedules; all 14 validators, lint, typecheck, production build and production audit PASS.
- [Android run 37777907157](https://github.com/keisaj9006/SecondPartShop/actions/runs/37777907157): production-style AAB dry run PASS on the same code SHA, ephemeral CI key and Firebase placeholder. This is not a Play-submitted artifact or physical-device result.
- Immutable code Preview: https://second-part-shop-h4xnek9t9-joannakwapis11-5369.vercel.app; deployment `dpl_37AaL39341SwX6AvShdMPD9QDk3J`, target Preview, READY; GitHub deployment 6935647814 tied to the exact code SHA.
- [26 HTTP checks](2026-10-08-preview-smoke.json) PASS: public Home/Account/Garage/Dashboard/product/search/health; both false-auth-success negatives; 12 unauthorized private APIs; fit ON 503 versus explicit OFF 200; native callback and confirmation 307 to same-origin coordinated continuation; Home invalid context has no listing links.
- Real browser verification on that Preview: invalid catalogue fit ON remains at the same URL with zero results and compatibility error after refresh; explicit Reset removes that context and renders six listings. The earlier quantity-one product -> sign-in return route preserved intended product/sort; all requested signup viewport widths were measured.
- Read-only actual hosted push schema has the expected unique provider/token and profile FK constraints and no timestamp-changing trigger, matching the CAS assumptions. No FCM row or provider token was written during QA.

This evidence document is committed after the verified code. Its documentation-only commit keeps the application, tests, workflows and lockfile identical to the code SHA above. The current branch-tip commit and Preview are exposed by PR #17/checks and the handoff; the immutable code deployment above remains the reproducible runtime evidence.

## Remaining severity and files

Known remaining defects in the reviewed RC26 scope: **P0: 0; P1: 0**. Independent review classified RC26-06 checkout/fitting serialization and both RC26-08 retained-participant authorization defects as FIXED / VERIFIED. [Independent closure evidence](2026-10-08-safe-acceptance-independent-review.md). Full normal-flow Auth + Storage deletion remains an external acceptance gate, not evidence that these repaired defects are still known-open.

The native dot-segment P2 is repaired in the continuation. Four pre-existing lint warnings remain. The latest continuation checkpoint and compact owner pack supersede the historical owner steps below; no unrelated future features were added.

Changed product areas/files: `src/app/page.tsx`, marketplace API, saved-search action and vehicle-context persistence; mobile completion page; native App mode, native push/settings/sign-out/continuation helpers; Account/auth actions and routes; shared `src/lib/auth-return.ts` and signed device-binding helpers. Regression scripts, the QA workflow, Android/FCM runbooks, scale/Preview JSON and release evidence changed alongside them. [Complete file diff](https://github.com/keisaj9006/SecondPartShop/pull/17/files).

Signing-secret rotation invalidates installation cookies; follow the FCM runbook's controlled disable/re-enrollment recovery. It is an operational requirement, not permission to weaken binding verification. Fresh email/provider/device evidence remains unsigned.

## Exact remaining owner / external gates

1. Hosted repair, readback, rollback-only acceptance and exact deployed-body isolated PG17 proof are complete. The unsafe committed shared-host package is rejected and quarantined; no further owner approval for it is requested. Normal destructive deletion remains separately scoped to a fresh disposable identity.
2. Smallest owner action: open the current PR #17 Preview, register a fresh disposable email, click its confirmation email and reply DONE. This supplies the genuine mailbox step; synthetic Auth Admin identities do not count. Recovery, authenticated lifecycle and normal deletion evidence will be recorded separately.
3. Owner-known DVSA vehicle/derivative confirmation and short critical visual check; no registrations copied into public fixtures or logs.
4. Stripe Sandbox browser-return/adverse flow and configured test fixtures; real FCM runtime inputs/delivery and physical Android camera/gallery, returns and test-track acceptance.
5. Final signing/App Links, submitted AAB, Data Safety, support/legal/contracting identity and marketplace supply gates remain as documented; no Play submission authorized.

Current official Google Play rules checked 8 October: new submissions target API 36; applicable 64-bit Android 15+ apps need 16 KB pages. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-EN) and [Android page sizes](https://developer.android.com/guide/practices/page-sizes). Read with `docs/SECOND_PART_1_0_CHECKLIST.md`; this execution report does not claim launch readiness.

## Safer acceptance strategy — completed technical evidence

- Owner rejected committed shared-host concurrency and global worker execution against unrelated requests. Both the old SQL generator and the unexecuted persistent-fixture HTTP prototype are quarantined; evidence is retained.
- [Hosted rollback evidence](2026-10-08-hosted-deletion-acceptance.md): 32/32 actual scenarios, 448 zero fixture-count assertions, restored buyer roles/profile timestamps, unchanged request queue and clean SQL context. [Exact reviewed manifest](2026-10-08-hosted-rollback-manifest.json) and [results](2026-10-08-hosted-rollback-results.json) are preserved.
- [Exact deployed-body PG17 evidence](2026-10-08-exact-deployed-pg17.md): 67/67 PASS on PostgreSQL 17.11, all seven actual advisory-wait schedules, definitions/owners/ACLs checked unchanged before and after. Hosted is 17.6; supporting isolated schema/helpers are fixtures, not a hosted clone.
- Local integrated suite: 1,102/1,102 PASS, zero failures/skips; lint zero errors and four unchanged warnings. First CI run 37802359979 passed all six SQL jobs, including exact-body deletion proof; its general validation stopped on two whitespace-only lines in the quarantined generator. Those lines were removed for the final rerun.
- [Other non-destructive RC evidence](2026-10-08-nondestructive-rc-evidence.md): current application Preview 14/14 GET checks, 103 targeted local checks, Android static validation and Stripe Sandbox configuration reads. No new authenticated fixture lifecycle, real provider transaction, browser viewport or physical-device PASS is implied.
- Three previously created synthetic Auth identities remain intact. Their temporary provisioner expired and returned 404/unavailable. No Auth account or Storage object was deleted; no global worker, shared committed fixture cleanup, main modification, Production deployment or Stripe Live operation occurred in this acceptance pass.
