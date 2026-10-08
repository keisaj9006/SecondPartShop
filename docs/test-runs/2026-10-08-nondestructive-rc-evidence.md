# Non-destructive RC evidence — 8 October 2026

Scope: public GET-only Preview checks, local behavioral/static tests, Stripe Sandbox configuration reads and official Android policy reads. This pass does not execute the prepared authenticated product HTTP harness, decrypt fixture credentials, create/clean hosted fixtures, request/delete accounts, run maintenance workers, deploy Production or use Stripe Live.

## Exact runtime and results

Checked code HEAD: `5232649915ce16f05bc017da704db7d58f261190`. Current immutable Preview supplied by the release coordinator: https://second-part-shop-qb8j304eg-joannakwapis11-5369.vercel.app (GitHub deployment `6937160074`). Public GET checks completed at `2026-10-08T15:33:27.826Z`: **14/14 PASS**.

| Checks | Observed result |
| --- | --- |
| Home, Account, keyword search | HTTP 200 |
| Anonymous Garage and Dashboard | HTTP 200 streaming shell contains the same-origin Next redirect to Account with the correct `/garage` or `/dashboard` return path; protected content is not rendered |
| Invalid catalogue fit ON, web | HTTP 200; zero `/parts/` listing links; compatibility error remains visible |
| Same invalid catalogue, explicit fit OFF | HTTP 200; eight listing links (two links per visible card); API returns six eligible items |
| Marketplace API invalid fit ON/OFF | 503 / 200 respectively |
| Mobile health | 200, `ok=true`, `backendReady=true`; configuration presence only |
| Anonymous Garage, saved searches, reviews and Verified Fit APIs | Each 401, `unauthorized`, `no-store` |

An initial probe on the preceding immutable Preview reported three expectation mismatches: it expected a 307 HTTP response from streamed Next pages and searched for `/part/` rather than the implemented `/parts/` links. HTML/source inspection resolved these harness assumptions; the fresh current-HEAD checks above use the actual contracts. The prepared mutation harness remains unexecuted and its old anonymous-redirect expectation must be corrected before any future authorized execution.

## Fresh local verification

- `node scripts/validate-android-rc-gate.mjs`: PASS; all 44 required physical scenarios remain documented. This is a runbook gate, not physical execution.
- `node scripts/validate-mobile-performance.mjs`: PASS for its source invariants, including hosted root navigation; some checks cover legacy files. It is not measured WebView latency.
- Android release-workflow/Preview-origin, native App Links, hosted native push and Preview-harness guard suite: **60/60 PASS**. Files: `test-android-release-workflow.mjs`, `test-android-preview-origin.mjs`, `test-native-app-mode.mjs`, `test-hosted-native-push.mjs`, `test-qa-preview-product-http.mjs`.
- Header/vehicle-select accessibility, final-RC vehicle context/saved searches, Garage fit selection/ownership suite: **43/43 PASS**. Files: `test-header-accessibility.mjs`, `test-vehicle-select-accessibility.mjs`, `test-final-rc-vehicle-context.mjs`, `test-final-rc-saved-search.mjs`, `test-garage-fit-selection.mjs`, `test-garage-ownership.mjs`.

The browser inventory returned zero available surfaces; fresh viewport, zoom, focus, screen-reader and client-persistence checks were unavailable. Preserve the earlier measured signup viewport evidence at 320, 360, 390, 430, 768, 1024, 1280 and 1440 in [the earlier RC report](2026-10-08-final-rc-hardening.md); these local component tests do not expand that browser evidence.

## Stripe and Android boundaries

A read-only Stripe connector check selected **SecondPart sandbox**, `livemode=false`. Its one configured webhook is enabled, test mode, API version `2026-08-26.dahlia`, at `https://second-part-shop-preview.vercel.app/api/stripe/webhook`, with the four Checkout events, payment-failure and two dispute events. No payment, refund, transfer, replay or endpoint changes were made. This proves connector/webhook configuration only: it does not verify the exact immutable Preview's key mode, alias SHA, event delivery or adverse commerce scenarios.

Android target/compile SDK 36 is enforced by the production patch and both release workflows. Those Android build inputs have no diff from the already verified `62362de` production-style AAB dry run [37777907157](https://github.com/keisaj9006/SecondPartShop/actions/runs/37777907157). That artifact uses ephemeral CI signing/Firebase placeholders and is not a submitted Play RC; no new Android build was claimed in this pass.

Official rules re-read on 8 October 2026:

- [Google Play target API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-EN): new apps/updates require API 36 from 31 August 2026; an extension to 1 November 2026 may be requested. Existing-app availability is a distinct API-35 rule.
- [Android 16 KB compatibility guidance](https://developer.android.com/guide/practices/page-sizes): API-35+ apps on 64-bit devices must support 16 KB pages; the current page separately states that updates lacking support cannot be released from 1 February 2027. This update-enforcement date does not waive compatibility or certify a new submission. Java/Kotlin-only apps including dependencies support 16 KB; packages with native shared libraries require artifact/ELF and zip-alignment inspection. The submitted artifact has not been inspected or tested here, so the existing 16 KB technical release check remains open.

## Remaining acceptance gaps

Authenticated Garage save/remove/current switch and saved-search round trip, seller draft/import/Storage lifecycle, fresh mailbox confirmation/recovery, normal Auth/Storage deletion, adverse Stripe Sandbox flows, exact submitted AAB/signing/App Links/16 KB evidence and physical camera/Back/network/FCM remain separate gates. No product defect was reproduced by this bounded pass. SQL defect classification and rollback/exact-hosted-body concurrency acceptance belong to the separately reviewed SQL evidence; an unavailable or unsafe additional test alone is not proof that a repaired defect remains open.
