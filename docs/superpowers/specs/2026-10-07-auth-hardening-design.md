# SecondPart Auth Hardening Design

Date: 2026-10-07
Branch: `codex/auth-hardening`
Stacked base: `codex/dvsa-integration` at `387fd8045d0a8a643b5fe393fa126e9f978eb192`
Status: Design for user review; no implementation authorized by this document.

## Goal and boundary

Close the P1 authentication release blocker found during real-user QA while preserving the current DVSA/Garage release-candidate state. Improve the signup, confirmation, resend, profile-read, account-dashboard, and password-reset experience without changing identity, authorization, database, RLS, or payment architecture.

The Supabase Auth provider remains authoritative for credentials, confirmation, recovery, and sessions. No schema migration, new account-state table, custom rate-limiter, production configuration change, or alternate identity source is proposed. This is not an account redesign.

## Evidence from the current branch

The following are direct observations from the current source at the base commit:

- `src/app/auth/actions.ts` validates signup email, password length, name, and terms, but does not read or compare `confirmPassword`. It returns the provider's raw sign-in and signup error messages. When signup succeeds without a session, its message appears in the regular form.
- `src/components/auth-form.tsx` has no signup confirmation-password field or one-submit guard. It renders the action state in place and offers a resend link after signup.
- `src/app/auth/actions.ts` reports “Confirmation email sent” whenever `resend()` returns no error. The API result alone does not establish that a message was delivered, and provider errors currently collapse to a generic resend failure.
- `src/app/auth/confirm/route.ts` and `src/app/auth/callback/route.ts` immediately redirect after successful OTP verification or PKCE exchange. Confirmation failures go to an account query-string message; recovery failures go to the forgot-password page. Neither route provides a dedicated confirmation-complete view.
- `src/lib/auth.ts` ignores the error result from `auth.getUser()` and the profiles query. `getCurrentProfile()` returns `null` for both “no profile” and query failure.
- `src/app/account/page.tsx` uses `if (!user || !profile)` to render the signed-out form. This can misrepresent an authenticated session when profile retrieval fails.
- `src/components/account-dashboard-content.tsx` has optional reads that may reject the full dashboard render, while other reads convert failures to `0` or `null`, which can look like valid empty data.
- `src/app/auth/actions.ts` already validates both password fields on password update. The reset form has both fields, but its lifecycle and return-path behavior need regression coverage.
- `src/lib/auth-email-origin.ts` restricts request origins to configured Vercel/configured origins and sanitizes internal return paths. This is application-code evidence only; it does not prove the deployed Supabase redirect allowlist.

No conclusion about a specific user's email delivery, link-prefetch behavior, or the cause of hosted PostgREST timeouts is drawn from these code observations.

## Proposed behavior

### Signup

The signup form will collect Password and Confirm password. The client will give immediate mismatch feedback and prevent accidental repeated submissions while a signup request is pending. The server action will independently validate both values and reject mismatch before constructing a Supabase client or calling Auth. Passwords will never be returned in action state, URL parameters, telemetry, or logs.

Signup will use a bounded auth-error mapper instead of exposing provider messages. On a successful signup that requires email confirmation, the interface will transition to a dedicated “Check your email” state. It will show a safely masked form of the submitted email, explain the next step, preserve the sanitized role and `returnTo` in server/action state or safe internal links, and offer sign-in and resend actions. The email itself will not be placed in a URL. If Supabase returns an authenticated session, keep the existing immediate signed-in path.

The UI will not imply delivery merely because the signup API returned successfully. It will say that the request was accepted and to check the inbox/spam folder, with wording reviewed against Supabase's response semantics.

### Confirmation and recovery callbacks

Both token-hash and PKCE callback paths will retain the existing server-side verification/exchange and cookie-bound session handling. On a valid first signup confirmation, redirect to a dedicated same-origin success page that clearly says:

- “Email confirmed”
- “Your SecondPart account is ready.”

Preserve a sanitized internal `returnTo`; the success page will provide a clear Continue/sign-in action and must not redirect invisibly before the user can see confirmation success.

For consumed, expired, malformed, or provider-rejected signup links, show “This confirmation link is no longer valid.” Provide Sign in and Request another confirmation email actions. Keep recovery-link failure distinct and route it to recovery-specific guidance; do not label a password-recovery failure as signup confirmation failure. If an already-confirmed authenticated session reaches the confirmation route, display an accurate already-confirmed/continue state rather than claiming the account is broken.

All return destinations remain constrained by the existing same-origin internal-path sanitizer. Never accept a callback host supplied by query parameters.

### Resend and provider limits

Add a visible cooldown and disable repeated rapid resends in the client. Treat that cooldown as local UX protection, not proof of provider delivery or a substitute for provider rate limits. Map provider 429/rate-limit responses to a truthful “Please wait before trying again” message and do not reset the cooldown on a failed request in a way that encourages rapid retries.

For unauthenticated email submissions, keep a neutral response that does not confirm whether an account exists. Do not query arbitrary emails to determine confirmation status. An authenticated user may see their own confirmed/unconfirmed status based on the current Auth session. “Confirmation email sent” is reserved for a response contract that actually establishes dispatch; where delivery is unobservable, say the request was accepted or that the user should check later, without promising inbox delivery. Never expose raw provider error text.

### Auth errors and session/profile reads

Centralize safe mapping for invalid credentials, unconfirmed account, already registered/confirmation-required, rate limits, invalid or expired links, password mismatch/length, network/provider unavailability, and an unexpected fallback. Copy must be actionable without exposing provider internals or enabling account enumeration. Keep the forgot-password response neutral for unknown emails. Do not log passwords, OTPs, token hashes, access tokens, or full confirmation URLs.

Represent auth/profile lookup outcomes distinctly: unauthenticated; authenticated with a profile; authenticated with no profile; authenticated with a transient profile-read failure. A transient profile query error must render an authenticated retry/recovery state, never a normal signed-out login form. If Auth confirms an authenticated user but the application profile is genuinely missing, remain authenticated, fail closed for seller/admin/protected role access, show a recoverable account-profile unavailable state, and provide Retry plus appropriate support/recovery guidance. Do not manufacture a profile, role, or permissions. Transient profile-read error and genuinely missing profile remain distinct states.

Repository inspection found the established `private.handle_new_user()` trigger, which creates a profile during Auth user creation; no established post-creation profile-repair mechanism was found. The signup trigger is not a repair path for an already-created user. Do not invoke or add profile repair in this task.

Authorization remains fail-closed. `requireSeller` and `requireAdmin` must not grant access when profile retrieval fails or is missing. No role fallback, RLS weakening, service-role client use in user-facing reads, or trust in client-supplied role is allowed. Auth lookup errors must not be silently treated as proof of logout.

### Account dashboard resilience

Keep the signed-in account shell visible when safe optional dashboard reads fail. Isolate optional cards/sections and show an explicit unavailable/retry state rather than fabricated zero counts or a global error page. A retry must rerun only the failed optional reads where practical. The account identity and role authorization remain critical; if they cannot be verified, block protected content and show a recoverable error. Do not catch a critical authorization failure and render protected seller/admin data.

### Password reset and return paths

Retain the existing server-side password/confirmation comparison and active-session requirement. Add client mismatch feedback and regression coverage for request reset → email callback → reset form → update password → sign-in with new password, as far as automated tests can establish without claiming real email delivery. Preserve recovery mobile return behavior and the existing sanitized `returnTo` contract. Used/expired recovery links must offer a new reset request and must not show signup-confirmation copy.

### Preview redirects: external configuration gate

Application code currently restricts callback origins, but the connected tools did not expose the hosted Supabase Auth URL Configuration. This design does not invent or change hosted values. Before declaring Preview Auth redirect verification complete, an authorized operator must inspect **Supabase Dashboard → Authentication → URL Configuration** for the project used by the exact-head Preview and record:

1. the Supabase project ref and Preview deployment's actual `NEXT_PUBLIC_SUPABASE_URL` project ref;
2. the configured **Site URL** exactly as shown;
3. every **Additional Redirect URL** entry exactly as shown;
4. whether the exact stable Preview origin and current branch Preview origin are both allowed, with the callback path `/auth/confirm` (and `/auth/callback` if any active template/provider flow uses it);
5. whether recovery callbacks using `/auth/confirm?next=/auth/reset-password` resolve to that same allowed Preview origin;
6. whether any localhost, wildcard, stale deployment, or unexpected Production origin remains in the Preview project configuration.

Record only non-secret URLs and project identifiers. Do not change Production configuration. If a required Preview URL is missing, stop the hosted end-to-end claim and request the project owner's configuration action; do not silently substitute a different origin.

## Error and privacy rules

- Use generic, actionable copy for provider/network failures and preserve account-enumeration protection.
- Only report a confirmed state when it is supported by the current Auth session or successful OTP/PKCE verification.
- Do not claim a confirmation or reset email was delivered based only on an error-free API response.
- Never put passwords, tokens, OTPs, or provider error details in client-visible URLs or logs.
- Keep callback and return navigation same-origin and internal-path-only.
- Security-sensitive reads and role checks fail closed.

## Regression and acceptance coverage

Automated tests should exercise:

1. password confirmation mismatch rejected before Supabase signup; both client feedback and server enforcement;
2. rapid/double signup submit produces no duplicate signup request;
3. successful confirmation-required signup shows dedicated Check your email state without claiming delivery;
4. valid token-hash and PKCE confirmation show explicit success, preserve safe `returnTo`, and maintain session cookies;
5. expired, malformed, provider-error, and already-used confirmation links show recoverable, accurate states;
6. resend local cooldown, disabled/pending state, repeated clicks, provider 429, provider/network errors, and neutral unauthenticated messaging;
7. already-confirmed authenticated user state;
8. resend confirmation remains enumeration-neutral; forgot/reset-password remains enumeration-neutral; signup error mapping creates no additional account-enumeration channel beyond Supabase's configured provider semantics. Do not build an account-existence lookup endpoint;
9. authenticated profile query failure is distinct from unauthenticated and missing-profile states;
10. optional account-dashboard query failures do not crash the shell or become false zero counts, while critical auth/authorization failures block protected content;
11. password-reset confirmation mismatch, expired session, successful update contract, old-password rejection/new-password acceptance as provider E2E;
12. internal `returnTo` preservation and rejection of external, protocol-relative, backslash, or malformed destinations;
13. Preview-origin callback selection from allowed request/branch/deployment origins and rejection of untrusted origins;
14. Android auth return compatibility for signup confirmation, recovery, and password-updated routes.

Tests may use unit/component/action harnesses for deterministic branches, but mocks do not prove email delivery, provider rate limits, configured hosted redirect URLs, or a real fresh-user lifecycle.

## Fresh external Auth E2E gate

Auth cannot be marked PASS from mocks alone. After code and Preview gates, a genuinely fresh external mailbox/account must complete:

Create account → receive the message → click confirmation once → land on the correct Preview → see explicit success → open account/profile → logout → login successfully.

The same fresh-account test record must cover resend before confirmation, rapid resend, a used link, forgot/reset password, wrong password, and client/server confirm-password mismatch. Do not reuse an already-confirmed test account as evidence for fresh signup.

Before attempting external email E2E, verify that the Preview's provider configuration can send to the chosen external mailbox. The current repository release documentation records that the organization is on Supabase Free and that the default SMTP service is restricted/best-effort; if the chosen recipient is not eligible under the current provider configuration, stop and report the exact owner action needed (for example, configure a verified custom SMTP sender) rather than repeatedly sending or claiming PASS. This design does not authorize paid-plan changes, SMTP setup, or changes to live credentials.

## Production email and link-scanner release gate

This Preview Auth Hardening work does not configure Production email infrastructure. Before public Production launch, require all of the following:

- controlled custom transactional SMTP;
- verified sending domain;
- SPF, DKIM, and DMARC;
- link tracking disabled wherever it can rewrite authentication links;
- confirmation-email deliverability test;
- password-reset deliverability test;
- explicit assessment and mitigation of email security scanners or link-prefetch systems that may consume single-use confirmation links before the user does.

If a two-step confirmation page, OTP-based confirmation, or another Supabase-supported mitigation is ultimately required, treat it as a deliberate Production auth/email-template decision. Do not make that change opportunistically in this Preview task.

## Verification and release sequence

After implementation, follow this non-circular stacked-branch sequence:

A. implement on `codex/auth-hardening`;
B. run focused and full automated Auth QA;
C. complete independent review;
D. deploy and verify an exact-head `codex/auth-hardening` Preview;
E. obtain fresh external Auth E2E PASS;
F. review the stacked Auth PR;
G. merge `codex/auth-hardening` → `codex/dvsa-integration`;
H. PR #10 receives the integrated Auth commits;
I. rerun full integrated automated regression on the new PR #10 HEAD;
J. deploy an exact-head PR #10 Preview;
K. run targeted integrated manual QA: signup/confirmation/login/reset; Garage current-vehicle switching; DVSA SE66 PPO; DVSA MT71 JZG; compatibility ON/OFF; and refresh/persistence;
L. only after PASS may PR #10 be considered for merge into `rebuild-nextjs`.

Do not merge to `main` or deploy Production. PR #10 remains open until the sequence above and its integrated manual QA pass.

No work in this design changes `main`, Production, hosted Supabase settings, database schema, RLS, payment state, or PR merge state.
