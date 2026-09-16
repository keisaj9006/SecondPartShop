# SecondPart account-deletion E2E attempt — 2026-09-16

## Scope

This records an attempted destructive QA account-deletion run on `rebuild-nextjs` using disposable buyer identities created specifically for deletion testing.

No Production environment, real customer account, real financial transaction or retained customer evidence was used. No password, access token, mailbox address, service-role key, one-time Auth token or CRON secret is recorded here.

## Original disposable identity

- disposable QA profile: `ae6d5751-b186-4597-abe1-d41641e0f230`
- profile role: `buyer`
- profile display label: `Delete QA2 20260916`
- account created through the normal SecondPart signup UI
- signup confirmation mail was received from the configured Supabase project
- final direct Auth verification confirmed `email_confirmed_at` is set

## Original auth redirect defect

One signup confirmation mail generated during the first attempt contained `redirect_to=http://localhost:3000`. Opening that one-time confirmation link still verified the disposable identity before the localhost redirect failed, but a real Preview user must not be sent to localhost.

A password-reset message from the same earlier test window also contained a localhost return target. The defect therefore affected real Auth email generation, not only a static test expectation.

## Repair and targeted Preview regression

The auth return-origin resolver was repaired so Preview email actions prefer the Vercel branch URL, then the exact Vercel deployment URL, before the configured fallback. The current branch head for this regression is `4e712cdf8ed1197249fe45bd2b2c23e115fd05ae`.

Verification at that exact head:

- GitHub Actions run `35096527654` completed successfully. Lint, typecheck, the full test command, all configured validators and the production build passed; the isolated marketplace-scale and last-stock-concurrency jobs also passed.
- Vercel Preview deployment `dpl_134etiRpLzeCyQQ2kGutnh1GANPR` is `READY` for the exact same SHA and serves the stable `rebuild-nextjs` branch alias.
- A fresh disposable buyer was created through the normal Preview signup UI after the earlier Auth email-send rate limit cleared. The generated signup confirmation message returned to the stable `rebuild-nextjs` Preview `/auth/callback?next=/account` path, not localhost.
- A fresh normal Preview Forgot password request completed successfully in the UI. The generated recovery message returned to the same stable Preview `/auth/callback?next=/auth/reset-password` path, not localhost.
- The fresh disposable signup identity remains unconfirmed in Auth because the one-time signup token itself was not traversed by the available automation path. No manual Auth confirmation or database status edit was used to manufacture a passing result.

This is sufficient to classify the **generated Preview signup/recovery return-origin defect as resolved and regression-verified**. It is not evidence that the complete signup callback, reset-password completion or deletion lifecycle passed end to end.

## Deletion-run status

The full Scenario A deletion run is still **not completed** and must not be classified as PASS.

The runbook requires the normal UI for account creation and deletion request, plus the normal `/api/commerce/maintenance` worker. Manual deletion-state RPCs, manual status edits and manual Auth deletion are explicitly prohibited for a release PASS.

No deletion request was manually inserted or advanced. No `claim_account_deletion_request`, `prepare_claimed_account_deletion`, `complete_account_deletion_request` or direct Auth hard-delete was used to claim release evidence.

## Classification

- **VERIFIED:** current Preview deployment/branch alignment at `4e712cdf`; CI/build/validator success for that SHA; normal signup UI can create a disposable buyer; normal Forgot password UI can request recovery; newly generated signup and recovery emails both use the stable Preview callback origin instead of localhost.
- **RESOLVED / REGRESSION-VERIFIED:** the observed Preview Auth email return-origin defect for generated signup and recovery links.
- **PENDING / MANUAL-AUTH-CALLBACK GATE:** the fresh one-time signup confirmation callback was not traversed, so the new disposable buyer is not yet an authenticated session suitable for the destructive deletion run.
- **NOT CLAIMED:** deletion request UI acceptance, maintenance-worker hard deletion, Auth absence, Storage cleanup, data cleanup, retry idempotency, complete signup callback and complete password reset.

## Next safe action

Use a disposable buyer whose confirmation callback has completed through the normal Preview flow. Then create only harmless disposable personal data, submit deletion through Account → Security, invoke the normal authenticated `/api/commerce/maintenance` worker, verify Auth/DB/Storage cleanup, and run a second maintenance pass to prove idempotency. If the confirmation callback remains unavailable to automation, keep that step explicitly manual and continue other unblocked RC P0 evidence in parallel rather than bypassing Auth state.