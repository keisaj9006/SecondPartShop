# Auth, browser and integration remainder — 8 October 2026

Baseline: codex/final-rc-hardening at 8ed1fc002c03af6f8865e23d754437f7a2c93d9e. Final continuation HEAD and CI are recorded in PR #17 and the final checkpoint.

## Auth automated evidence
Fresh `node --test scripts/test-auth-*.mjs`: **105/105 PASS**, zero failed/skipped. Actual actions/routes/components execute with provider seams; real SSR stale-cookie cases use the installed Supabase SDK. Coverage includes Buyer/Seller validation, password mismatch, duplicate submit and pending guards, confirmation-required and existing-address behavior, already-confirmed only with verified current Auth, used/expired/network-error outcomes, recovery handling, safe return paths/origins, independent Auth/profile state, fail-closed seller/admin access and Android recovery/completion. These provider seams do not prove email delivery or external token consumption.

Fresh read-only Preview HTTP suite: **45/45 PASS** on verified code SHA 63c07a30672df950907e367a66395e9b0f48e6d8 at https://second-part-shop-azfppzb01-joannakwapis11-5369.vercel.app; accompanying JSON records eight public Auth checks, 36 anonymous/malformed-bearer private API checks and one stale persisted SSR cookie. Private APIs returned 401 unauthorized/no-store. A synthetic expired token redirects to invalid status; forged confirmed/already-confirmed queries cannot invent confirmation. Recovery pages render and unsafe returnTo is not forwarded.

## Actual browser evidence
Using the supported in-app browser on the baseline Preview:
- Anonymous Sign in and both Buyer/Seller signup modes render. Empty signup submit remains on form and focuses required displayName. All five visible signup fields require values/consent; the Seller toggle changes the submit label and preserves buyer capabilities.
- At widths 320, 360, 390, 430, 768, 1024, 1280 and 1440, document scrollWidth equals clientWidth, inputs fit inside the viewport and submit is visible. Temporary viewport overrides were reset.
- Invalid confirmation shows bounded recovery with same-origin sign-in/resend links.
- Manual catalogue selection Honda/Jazz/2016/JAZZ EX I-VTEC/1400cc/PETROL navigates with exact variant 207489f1-098d-4486-8be1-c6ffa056b58f and fit=1. Zero compatible listings is honestly shown. The representative hatchback visual explicitly disclaims exact trim/body/fitment.
- Explicit fit OFF returns six eligible listings with Fit not verified labels; refresh retains vehicle and fit=0.
- Remove vehicle clears anonymous selected context; refresh remains ordinary browse with no selected vehicle image.

No browser signup, terms acceptance, password update, email dispatch, account creation or authenticated mutation occurred. Anonymous vehicle selection is not hosted Garage persistence.

## Safe identity and provider boundary
A read-only hosted query verified all three retained synthetic identities still have the exact QA run marker and buyer roles. They are not external-mailbox proof. Automatic approval review rejected decrypting their quarantined credential store, citing the earlier explicit prohibition. No workaround or old harness execution followed. A narrowly scoped GET-only authorization question was presented while independent automation continued; dependent work remains gated until a reply.

Supabase URL Configuration redirected to sign-in in the available browser; the connector has no Auth-configuration read method. No settings or credentials were changed. Fresh email receive/click and provider URL configuration remain unsigned.

## Exact integration sequence — no merges performed
Repository default branch is main. All three current stacked ancestor checks pass; PRs #17, #16 and #10 initially report CLEAN/MERGEABLE. Merge commits are enabled and automatic branch deletion is disabled. Recheck exact heads, checks and mergeability immediately before authorized integration.

1. Merge PR #17 into codex/auth-hardening using a merge commit after acceptance and explicit integration authorization. Keep branches. Run rebuild-nextjs-qa.yml on the exact merge SHA and require web validation plus all six PostgreSQL jobs. Verify its exact Preview: anonymous Auth, Garage fit ON/OFF, private API 401 and maintenance guards. The RC-specific maintenance environment does not automatically transfer to this branch.
2. After those checks pass, merge PR #16 into codex/dvsa-integration using a merge commit. Run the same workflow and focused Auth/DVSA/Garage regressions on the exact merge SHA; verify catalogue identity/manual paths. Read the migration ledger and repaired definition hashes; do not blindly reapply the hosted repair.
3. After those checks pass, merge PR #10 into rebuild-nextjs using a merge commit. Require its push-triggered web/PostgreSQL QA, applicable baseline validators and dependency audit. Verify the moving Preview alias and immutable deployment, including origin/Auth/commerce/native negative boundaries. Run Android dry-run when native inputs change; otherwise verify artifact input equality.

At each integration, require git diff --check, lint, typecheck, build, npm test and applicable release validators. Preserve stacked ancestry; retain branches until descendants are verified. Main changes, Production promotion and Play submission require separate explicit authorization.

## Current maintenance boundary
The exact-code Preview rejects unauthenticated request-scoped maintenance with 401. The previous baseline authenticated nonexistent-request check returned 404. Repeating that authenticated check on the new Preview was unavailable because the retained maintenance secret could not be unprotected in the current execution context; no replacement secret, environment edit or global request was used. This is separate from the explicitly quarantined fixture credentials. The scoped route and empty configured QA target-map guard remain covered by regression tests.
