# SecondPart — Closed Beta Runbook

Snapshot: 2026-09-10
Branch: `rebuild-nextjs`
Package: `com.secondpart.marketplace`

This runbook turns Closed Beta into release evidence rather than a passive waiting period. It is for the final Google Play test-track build and should be used together with `docs/android-rc-test-matrix.md`, `docs/google-play-release-pack.md`, `docs/commerce-e2e-runbook.md` and `docs/account-deletion-e2e-runbook.md`.

## 1. Entry gate

Do not start the release-significant Closed Beta until all of the following are true:

- the build came from the real Production AAB workflow;
- the AAB evidence pack is retained with the exact commit SHA, package, version, AAB SHA-256, upload signer SHA-256 and merged permissions;
- the app is installed through a Google Play test track rather than only by local sideload;
- the Production origin passes the live-origin preflight;
- the Production support mailbox is real and monitored;
- the buyer and seller reviewer/test accounts exist without credentials being stored in GitHub;
- testers have a clear route to `/beta-feedback` from the signed-in Contact page.

If public commerce is not yet cleared, testers must not create uncontrolled real-money transactions. Money-flow testing follows the separate controlled Stripe E2E runbook.

## 2. Tester cohort

First confirm the Play Console developer account type and whether the new-personal-account testing rule applies.

For a personal developer account created after 13 November 2023, Google currently requires at least 12 testers to remain opted in continuously for at least 14 days before the developer can apply for Production access. Recruit more than the minimum so one tester dropping out does not invalidate the cohort.

Operational target for SecondPart if that rule applies:

- invite 15–18 relevant testers;
- keep at least 12 continuously opted in for the full required period;
- record the actual Closed Test start date from Play Console;
- do not treat a person who opted out and rejoined as continuously opted in;
- keep testing while bugs are fixed and new Closed Test builds are promoted.

Official requirement to re-check before starting the clock:
https://support.google.com/googleplay/android-developer/answer/14151465

## 3. What every tester should receive

Send testers:

1. the Google Play Closed Test opt-in link;
2. a short explanation that this is a pre-release marketplace build;
3. the exact high-level test tasks below;
4. instructions to use Contact -> Closed Beta -> Send beta feedback for each separate issue;
5. a warning not to paste passwords, card data, API keys or other sensitive information into feedback;
6. a request not to opt out until the test period is formally complete if the Play continuous-opt-in rule applies.

Do not send production signing secrets, service-role keys, Stripe secrets or admin credentials to testers.

## 4. Core test missions

Each tester does not need to execute every destructive or commerce scenario. Across the cohort, however, the following product surfaces must receive real use.

### Mission A — First run and account

- launch from the Google Play test-track installation;
- sign up or sign in;
- log out and sign back in;
- exercise account recovery where appropriate;
- switch between Buyer and Seller account modes where the account is eligible;
- open Security & account and verify the account-deletion entry point is discoverable.

### Mission B — Home, Search and navigation

- move repeatedly across bottom navigation in both directions;
- open Home, Search, Garage, saved/account surfaces and return using Android hardware Back;
- search several realistic part names/OEM-style terms;
- apply/remove filters and sorting;
- scroll through enough results to exercise pagination;
- report visible stalls, stale screens, layout jumps or navigation state loss.

### Mission C — Garage and compatibility

- add/select a vehicle;
- change to a different vehicle without the previous vehicle being incorrectly pre-filled;
- toggle `Show only parts that fit this vehicle` on and off;
- compare filtered and unfiltered results;
- open compatible, family-match and unverified listings where available;
- verify that compatibility warnings cannot be silently bypassed before purchase.

Until DVSA registration lookup is approved and configured, manual vehicle selection is the expected fallback and is not a beta failure.

### Mission D — Buyer marketplace flows

- open listing details and seller information;
- save/unsave parts and searches;
- use buyer/seller messaging;
- exercise Find My Part with non-sensitive test data;
- open order and Buyer Protection surfaces where seeded/test orders are available;
- verify report/block controls where safe to do so.

Do not create uncontrolled real-money purchases only to satisfy this mission.

### Mission E — Seller flows

Use a dedicated seller test/reviewer account.

- open Seller mode and Seller Dashboard;
- inspect/edit the seller profile using test-safe data;
- add/edit a test listing and verify image upload/camera flow on a physical device;
- inspect compatibility entry and listing status;
- exercise inventory/import surfaces with a deliberately small QA file unless the bulk-import test is specifically being run;
- inspect Orders and Payments/Payout readiness surfaces without replacing real payout credentials.

### Mission F — Android/native behaviour

- camera/image selection and upload;
- verified App Link from the Production domain into the Play-installed app;
- push notification open/deep-link behaviour after Production FCM is configured;
- Android hardware Back;
- app background -> foreground recovery;
- temporary network loss -> recovery;
- orientation/responsive behaviour on supported device classes;
- no sensitive debug UI/logging visible in the Release build.

The formal PASS/FAIL evidence remains in `docs/android-rc-test-matrix.md`.

## 5. Controlled commerce and privacy missions

These are release-critical but must not be improvised by ordinary testers.

### Commerce

Use `docs/commerce-e2e-runbook.md` for the controlled Stripe test-mode sequence and edge cases. Public commerce is not cleared until the payout-recovery migration is deployed and the money-flow E2E passes.

### Account deletion

Use `docs/account-deletion-e2e-runbook.md` with a disposable QA account only. Never use a founder/admin account. The destructive E2E must verify Storage cleanup, PII transformation, hard Auth deletion, audit completion and retry/idempotency behaviour.

## 6. Feedback format and triage

The in-app `/beta-feedback` form stores a versioned `[BETA_FEEDBACK v1]` report in the existing authenticated `support_requests` queue. It records category, severity, area/route, server-side build SHA/environment, summary, reproduction steps and expected/actual result.

Administrators triage these reports at `/admin/beta-feedback`.

Severity policy:

- **Blocker** — tester cannot continue a key flow, data/security risk, crash loop, checkout safety issue or equivalent release stop. Do not promote the affected RC until resolved and regression-tested.
- **Major** — important Buyer/Seller/compatibility/navigation behaviour is broken but a workaround exists. Resolve before public launch unless explicitly accepted as a documented non-launch surface.
- **Minor** — the flow works but presentation, wording or secondary behaviour is wrong/confusing. Prioritise after blockers/majors.
- **Suggestion** — improvement rather than a defect. Keep separate from release blockers.

Use one report per issue. When fixed, mark the support item `in_progress`, retest the fix on the replacement Closed Test build, then close it only after the regression check passes.

## 7. Evidence to retain

For each release-significant Closed Beta build retain:

- Google Play track name and release version/versionCode;
- corresponding `android-release-evidence.json` / `.txt` and permission report;
- test start date and, where applicable, evidence that the required tester cohort remained continuously opted in;
- tester mission coverage, without unnecessary personal data;
- count of open blockers/majors/minors/suggestions;
- issue -> fixing commit/build -> regression result mapping for launch-blocking bugs;
- completed Android RC matrix;
- FCM E2E result;
- controlled commerce E2E result;
- destructive account-deletion E2E result;
- Production critical-alert smoke-test result;
- any Play pre-review or policy findings and their resolution.

Do not include passwords, complete personal addresses, payment card details, signing secrets or service credentials in screenshots/evidence.

## 8. GO / NO-GO rule

A Closed Test period finishing is not by itself a release PASS.

SecondPart is **NO-GO for public release** if any of these remain true:

- any unresolved Blocker;
- unresolved security/payment/data-integrity defect;
- required physical Android RC scenario has not passed;
- Production FCM is required for the release but E2E is unverified;
- Production domain/App Links/signing evidence is incomplete;
- required commerce or destructive deletion E2E is incomplete;
- Production monitoring/support prerequisites are not configured;
- Google Play account/app-content requirements are incomplete;
- the marketplace is being promoted broadly before the agreed liquidity gate.

The RC becomes technically eligible for release review only when the canonical `docs/launch-readiness.md` P0 gates and the applicable Google Play requirements are satisfied. Public buyer acquisition remains separately gated by marketplace liquidity.
