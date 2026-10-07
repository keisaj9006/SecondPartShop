# Auth hardening release evidence — 2026-10-07

## Candidate and deployment

- Branch: `codex/auth-hardening`
- Stacked base: `codex/dvsa-integration` at `387fd8045d0a8a643b5fe393fa126e9f978eb192`
- Auth-hardening baseline SHA before the Preview P1 regression: `ccb0f8af96b1a71949d4978a10b380512c920b91`. The P1 fix and final local gates were tested on code commit `bae100d97d1c0e3d50a53eeb4f2429aac94e5d5c`; the report-only follow-up does not change application code.
- Pull request: [#16 — Auth hardening stacked on DVSA integration](https://github.com/keisaj9006/SecondPartShop/pull/16), open and unmerged; base is `codex/dvsa-integration`.
- Vercel Preview: <https://second-part-shop-git-codex-auth-hardening-joannakwapis11-5369.vercel.app/>
- Exact P1 code deployment: `CP4JnHXS8EGrT9zBpoMtUzuMeAjn`; GitHub Vercel status for code commit `bae100d` is **success — Ready**.
- Cookie-free smoke checks against that deployment: Home `200`; `/account` `200` with Sign in and Create account; `/account?mode=signup` `200` with Create buyer account; `/api/mobile/v1/health` `200`, `backendReady: true`.
- Preview Supabase scope: the owner previously confirmed the Vercel project `second-part-shop` Preview environment uses the pre-production Supabase project `secondpart` (`etkupijfdznljimrfyct`, `eu-west-2`). The public health response confirms backend configuration is present but intentionally does not reveal the project reference; this report relies on the owner-confirmed Vercel Preview environment inventory.

## Automated verification

- A real Preview QA report found a P1: the installed Supabase SSR client returns `AuthSessionMissingError` for a normal request with no auth cookie, while `getCurrentUserState()` treated every Auth error as an outage. The fix maps only the SDK's `isAuthSessionMissingError` result with no Supabase auth cookie to `unauthenticated`; the same error when an auth cookie is present, arbitrary Auth errors, and thrown network errors stay `error`.
- Regression coverage uses the installed `@supabase/ssr` client to reproduce the no-session response and a malformed persisted-session cookie. It runs the malformed cookie through the real proxy source and confirms that, even after the proxy clears it, a proxy-set request marker preserves fail-closed handling. It also verifies storage-cookie and chunk naming, anonymous `/account` sign-in and `/account?mode=signup`, outage recovery, and fail-closed seller/admin guards.
- Final focused Auth/Account tests: **16/16 passed**. Final full `npm test`: **882/882 passed**, 0 failed; `npm run lint`: passed with 0 errors and 4 existing warnings; `npm run typecheck`: passed; `npm run build`: passed.
- Focused Auth callback, confirmation status, and return-context scripts after the review fix: **37/37 passed**. Independent review also reran callback, confirmation-status, return-context, and account-state tests: **43/43 passed**.
- `npm run validate:dependencies`: passed; production dependency audit found 0 vulnerabilities after updating `sharp` from 0.35.4 to 0.35.5.
- `npm run validate:launch-baseline`: passed all code-level checks. It continues to report manual/external Play, legal, Production domain/Firebase, physical-device, FCM, checkout, camera, and deep-link launch inputs.
- `npm run validate:android-rc`: passed; 44 required physical/manual scenarios remain documented.
- `git diff --check`: passed.
- Independent review of the P1 fix found no remaining actionable issue. The review specifically verified proxy marker spoof resistance, malformed cookie clearing, cookie-name anchoring, and Account behavior. An additional regression proves an anonymous request with a forged marker still reaches the unauthenticated sign-in path.

## Gate status

| Gate | Status | Evidence / remaining action |
| --- | --- | --- |
| Local automated Auth and integrated suite | PASS | Results above. |
| Exact-head Vercel Preview | PASS | Exact code commit `bae100d` is Ready; cookie-free Home, Account, signup, and health smoke checks passed. |
| Clean-incognito anonymous Account | PENDING — manual visual check | Cookie-free HTTP confirms anonymous SSR renders both auth actions. Browser automation was unavailable, so the visual incognito check remains for the owner before any fresh-user signup test. |
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
