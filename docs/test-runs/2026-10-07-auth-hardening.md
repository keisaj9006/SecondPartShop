# Auth hardening release evidence — 2026-10-07

## Candidate and deployment

- Branch: `codex/auth-hardening`
- Stacked base: `codex/dvsa-integration` at `387fd8045d0a8a643b5fe393fa126e9f978eb192`
- Auth/application code SHA tested: `ccb0f8af96b1a71949d4978a10b380512c920b91`
- Pull request: [#16 — Auth hardening stacked on DVSA integration](https://github.com/keisaj9006/SecondPartShop/pull/16), open and unmerged; base is `codex/dvsa-integration`.
- Vercel Preview: <https://second-part-shop-git-codex-auth-hardening-joannakwapis11-5369.vercel.app/>
- Vercel deployment ID: `5o4es5ausnaZPXEDnxoYfQiYCe29`
- GitHub Vercel deployment status for the tested SHA: **success — Deployment has completed**. The Vercel Preview Comments check also completed successfully. No GitHub Actions workflow runs were returned for this SHA.
- Smoke checks on the Preview: Home `200`; `/api/mobile/v1/health` `200`, `backendReady: true`.
- Preview Supabase scope: the owner previously confirmed the Vercel project `second-part-shop` Preview environment uses the pre-production Supabase project `secondpart` (`etkupijfdznljimrfyct`, `eu-west-2`). The public health response confirms backend configuration is present but intentionally does not reveal the project reference; this report relies on the owner-confirmed Vercel Preview environment inventory.

## Automated verification

- Focused Auth callback, confirmation status, and return-context scripts after the review fix: **37/37 passed**. Independent review also reran callback, confirmation-status, return-context, and account-state tests: **43/43 passed**.
- Full `npm test`: **876/876 passed**, 0 failed.
- `npm run lint`: passed with 0 errors and 4 pre-existing warnings in mobile shell/test files.
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.3.8.
- `npm run validate:dependencies`: passed; production dependency audit found 0 vulnerabilities after updating `sharp` from 0.35.4 to 0.35.5.
- `npm run validate:launch-baseline`: passed all code-level checks. It continues to report manual/external Play, legal, Production domain/Firebase, physical-device, FCM, checkout, camera, and deep-link launch inputs.
- `npm run validate:android-rc`: passed; 44 required physical/manual scenarios remain documented.
- `git diff --check`: passed.
- Independent code review found one P2 issue: confirmation success was selected directly from `state=confirmed`. The page now requires `getCurrentUserState()` to return an authenticated user with `email_confirmed_at`; unauthenticated, unconfirmed, and Auth-read-error states render invalid-link recovery. Regression coverage passed, and the reviewer confirmed the fix with no remaining actionable findings.

## Gate status

| Gate | Status | Evidence / remaining action |
| --- | --- | --- |
| Local automated Auth and integrated suite | PASS | Results above. |
| Exact-head Vercel Preview | PASS | Vercel reports deployment complete for SHA `ccb0f8a`; Home and health return 200. |
| Preview backend configured | PASS | Health response reports `backendReady: true`. Project ref is based on the owner-confirmed Preview environment inventory above. |
| Supabase Auth URL Configuration | BLOCKED — owner inspection required | Read the `secondpart` project's Site URL and Additional Redirect URLs; confirm the exact Preview routes below are allowed. No Production Supabase settings were changed. |
| Fresh external mailbox E2E | BLOCKED — depends on URL gate and owner mailbox | Do not claim Auth E2E pass until a never-before-confirmed mailbox completes the fresh flow. |
| Auth PASS / merge to DVSA | NOT GRANTED | PR #16 remains open and unmerged. PR #10 remains open. |

## Owner gate — Preview only

In Supabase Dashboard, open project `secondpart` (`etkupijfdznljimrfyct`) → **Authentication → URL Configuration**. Read the Site URL and Additional Redirect URLs. Confirm that the exact Preview callback destinations are allowed:

- `https://second-part-shop-git-codex-auth-hardening-joannakwapis11-5369.vercel.app/auth/confirm`
- `https://second-part-shop-git-codex-auth-hardening-joannakwapis11-5369.vercel.app/auth/callback`

If either route is absent, add only the missing Preview URL(s) to this pre-production project. Do not change Production settings. Then provide the Site URL and the matching Additional Redirect URL entries (URLs only; no keys or secrets). The fresh mailbox test starts only after this is verified.

Use a never-before-confirmed external mailbox for signup → confirmation link → exact Preview → explicit success → profile access → logout/login. Then test resend before confirmation and rapid resend; used-link behavior; forgot/reset; old-password rejection/new-password acceptance; wrong password; and password mismatch. Stop on provider, SMTP, or redirect failure; do not claim delivery from mocks.

## Production email prerequisite

Preview hardening does not configure Production email. Before public launch, configure controlled custom transactional SMTP and a verified sending domain; publish SPF, DKIM, and DMARC; disable link tracking where it rewrites auth links; test confirmation and reset deliverability; and assess/mitigate email security scanners or link-prefetch systems consuming single-use confirmation links. Any two-step confirmation, OTP, or other Supabase-supported mitigation is a deliberate Production email/template decision and is outside this Preview task.

## Scope controls

No `main` change, Production deployment, Production Supabase change, or PR merge was performed. No DVSA, Supabase, Stripe, Firebase, or signing secrets are recorded here.
