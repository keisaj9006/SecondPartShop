# Marketplace Integrity checkpoint — 12 September 2026

Work stayed on `rebuild-nextjs`, Vercel Preview and the documented Supabase Preview project. No new Stripe transaction/onboarding, Production change, real email or alert was performed. This is engineering and bounded Preview evidence, not a SecondPart 1.0 launch declaration.

| Plan item | Outcome | Evidence |
| --- | --- | --- |
| Task 2 / photo integrity | Implementation and normal upload/delete PASS. Recovery-only runner reviewed and synthetic tests PASS. Actual HTTP negatives, provider recovery and independent committed-session outcomes remain BLOCKED/manual RC. | [Photo recovery](2026-09-12-photo-recovery.md), [original Preview checks](2026-09-11-photo-integrity-preview.md) |
| Task 3 / navigation | PASS, including exact submitted-query Back regression, page reset, safe storage access, cleared vehicle persistence and returned mobile cursor advancing 006 to 005. | [Navigation](2026-09-12-marketplace-navigation.md) |
| Task 4 / OPS-01 | PASS for synthetic redaction/reporting boundaries and reviewed endpoint/provider logging paths. Safe diagnostics retained; no real alerts. | [Redaction](2026-09-12-monitoring-redaction.md) |
| Task 5 / auth context | PASS for actual component/server-action boundaries and public Preview links/redirects. Signup/email confirmation/resend are synthetic; actual email delivery is separate. | [Auth context](2026-09-12-auth-return-context.md) |
| Task 6 / validation retry | Actual Preview retained-input/photo Draft retry PASS. Final integration review additionally found partial-upload replay duplication; fixed with explicit saved-listing recovery and independently retested synthetic failures. Final follow-up Preview acceptance is recorded in its report. | [Listing retry](2026-09-12-listing-validation-retry.md) |
| Task 7 / SEARCH-01/02, next approved unblocked P1 | PASS for complete search, global ordering, bounded hydration, canonical evidence and fail-closed caller context. Actual Preview SQL/API/browser checked; large-data SQL fixtures remain local. | [Search](2026-09-12-search-integrity.md) |

## Commits and verification

- `2586410`: navigation and mobile cursor repair; `d727be6`: Preview evidence.
- `0178131`: OPS redaction repair.
- `48f2d17`: safe full auth-return context, including normalized redirect rejection.
- `8e22927`: validation/File reset-order repair; `742ff19`: Preview evidence.
- `b210f76`: guarded recovery QA runner and explicit credential blocker.
- `123efa0`: complete search RPC, caller guards and preserved search/group order.
- `e907883`: prevent stale-form replay after a partial save, retaining sanitized diagnostics.

Final code checks after the integration repair: 233/233 tests, lint (zero errors, three pre-existing mobile-shell warnings), typecheck, production build and git diff --check PASS. All 14 validators PASS: notifications, mobile-performance, launch-baseline, monitoring, commerce-e2e, checkout-expiry-race, payout-recovery, android-rc, public-contact, account-deletion-e2e, production-origin, production-env, beta-feedback, seller-read-policy. These validators do not imply actual provider/device E2E success.

Every implementation received independent specification/semantic review. Final cross-task review reproduced the partial-upload retry issue and then independently confirmed its repair; no remaining actionable integration finding was reported. Recovery state is not a substitute for general cross-request idempotency or transactional uploads.

Latest code acceptance: `e90788390aa903c311cc1c8691e1e2d213258807`, CI `34691988792` SUCCESS, READY deployment `dpl_EG2F8okDfjhK1xjt4N7QpAosMJ5B` (`second-part-shop-7qo6elptg-joannakwapis11-5369.vercel.app`), both Preview aliases verified. Actual browser rejection retained edited values and photo feedback while DB/Storage remained unchanged; reloading restored the saved Draft. The following documentation-only publication does not change this tested application code; its final CI/alias state is verified separately at handoff.

## Remaining release gates and next work

Task 2 needs a trusted QA runtime already provisioned with the Preview service credential, an ordinary authenticated HTTP test session and two genuinely independent database sessions. Vercel returned the service credential only as `[SENSITIVE]`; temporary configuration was removed and no provider failure batch ran. Do not weaken secret protection, expose a debug endpoint or invoke broad maintenance as a workaround.

Other remaining P0/P1 work requires external configuration/business input or separate authorization: Auth leaked-password protection, commerce runbook B–H, physical Android/signing/FCM/release and legal gates, plus genuine professional seller inventory and response/fulfilment evidence (SUPPLY-01). The current instruction prohibits another payment. No remaining unblocked engineering P0/P1 from this approved batch was substituted with a speculative redesign. The next useful step is the grouped provider/device RC batch once its prerequisites are available, alongside authorized real seller supply work. The 100k-listing performance gate remains open; local PGlite timings are not capacity evidence.
