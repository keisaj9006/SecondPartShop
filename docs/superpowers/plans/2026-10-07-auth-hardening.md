# SecondPart Auth Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the P1 Auth release blocker on `codex/auth-hardening` with truthful, recoverable signup, confirmation, resend, profile, dashboard, and reset flows.

**Architecture:** Supabase Auth remains authoritative for identity, email confirmation, recovery, and sessions. Add a bounded provider-error mapper, explicit confirmation states, tri-state profile reads, and per-section optional dashboard failure states; preserve same-origin redirects and fail-closed role checks. Do not add tables, migrations, custom rate limiting, profile repair, or Production configuration.

**Tech Stack:** Next.js 16 App Router, React 19 Server Actions/Server Components, TypeScript, Supabase SSR/Auth, Node.js `node:test` scripts.

**Spec:** `docs/superpowers/specs/2026-10-07-auth-hardening-design.md`

## Global Constraints

- Work only on `codex/auth-hardening`, stacked on `codex/dvsa-integration` at `387fd8045d0a8a643b5fe393fa126e9f978eb192`.
- Do not modify or merge into `main`; do not deploy Production or change Production configuration.
- Do not weaken RLS, bypass email confirmation, trust client roles, expose secrets, or manually mutate Supabase Auth users to fake a pass.
- Reject password mismatch on the server before calling Supabase Auth; never log or return passwords, OTPs, token hashes, access tokens, or full callback URLs.
- Keep resend and forgot/reset responses enumeration-neutral; signup error mapping must add no account-enumeration channel beyond configured provider semantics. Do not create an account-existence endpoint.
- Keep callback and `returnTo` navigation same-origin and internal-path-only.
- Distinguish unauthenticated, missing profile, transient profile-read failure, and Auth-read failure. Missing profiles stay authenticated but cannot receive roles or permissions.
- Repository inspection found `private.handle_new_user()` creates a profile during Auth user creation; no established post-creation profile-repair path exists. Do not add or invoke repair.
- Optional dashboard failures must be visible as unavailable/retry states, never false zero counts; protected data stays fail-closed.
- Do not claim provider email delivery from an error-free API response or claim Auth PASS from mocks.
- Preview Auth URL Configuration and fresh external-user email lifecycle are release gates. This task does not configure Production email infrastructure.
- Use small commits; PR #10 remains open until integrated manual QA passes.

## Controlled Subagent Ownership

- Lead owns shared Auth contracts and integration, including `src/lib/auth.ts`, `src/app/auth/actions.ts`, shared interfaces, plan sequencing, and final integrated QA.
- Agent A owns Task 1 signup UI/tests and Task 2 confirmation/resend UI/routes/tests, but must not edit `src/app/auth/actions.ts`. Lead applies shared action changes after Agent A's relevant tests and isolated changes are reviewed. Run A's tasks serially.
- Agent B owns Task 3 account page/profile-state UI/tests only after Lead defines and commits the Auth/profile-state helper contract. Agent B also owns Task 4 dashboard files/tests. Agent B must not edit `src/lib/auth.ts`, `src/app/auth/actions.ts`, or shared Auth contracts.
- Agent C owns Task 5 reset UI and its new isolated tests; must not edit `src/app/auth/actions.ts` or shared return-context test files. Lead applies shared action changes after C's tests are reviewed.
- Do not run agents with overlapping files simultaneously. Task 6 is sequential and Lead-owned after Tasks 1–5 are integrated.

## Review Focus

- Provider error text can expose account existence or internal diagnostics — test every action context and keep user-facing mapping bounded.
- Replayed/expired OTP or PKCE callback can be mistaken for a first successful confirmation — test success, invalid, already-confirmed, and recovery states independently.
- A profile read error can be mistaken for logout or a missing profile — test the four auth/profile outcomes and verify all role guards fail closed.
- An optional data read can silently become zero/empty or crash the whole account page — test individual count, recent-list, seller, garage-partner, and saved-ID failures.
- Preview callback host or mobile return context can be lost or become attacker-controlled — test exact allowed origins, unsafe return paths, and Android return behavior.

---

### Task 1: Safe Auth Errors and Signup Confirmation

**Files:**
- Create: `src/lib/auth-error-messages.ts`
- Lead modifies: `src/app/auth/actions.ts`
- Modify: `src/components/auth-form.tsx`
- Modify: `src/lib/types.ts` only if the existing `ActionState` cannot express the action result without broadening other forms.
- Test: `scripts/test-auth-hardening-signup.mjs`
- Extend: `scripts/test-auth-return-context.mjs`

**Interfaces:**
- Produces: `authErrorMessage(error: {status?: number; code?: string; message?: string}, context: AuthErrorContext): string`, where `AuthErrorContext` is `"signin" | "signup" | "resend-confirmation" | "password-reset" | "update-password"`.
- Preserves existing `signUp(previous, formData): Promise<ActionState>`; confirmation-required success remains `status: "success"`, with the signup form rendering a dedicated in-place Check your email state.
- Client preserves sanitized role and `returnTo` without putting the submitted email in a URL.

- [ ] **Step 1: Add failing action tests** for missing/mismatched `confirmPassword`, signup not called on mismatch, valid signup payload, provider errors mapped without raw provider text, unknown-address-safe signup copy, and configured terms/return context.
- [ ] **Step 2: Run the focused test and verify the new assertions fail**: `node --test scripts/test-auth-hardening-signup.mjs`.
- [ ] **Step 3: Add `authErrorMessage`** and use it in sign-in, signup, resend, reset request, and password update actions. Map provider categories to bounded, actionable copy; keep unknown details generic.
- [ ] **Step 4: Add signup confirmation-password validation** in both `AuthForm` and `signUp`. The server must compare both values before creating a Supabase client or calling `auth.signUp`. Keep native pending disablement and add a synchronous one-submit guard.
- [ ] **Step 5: Render the confirmation-required signup result as a dedicated Check your email state** in `AuthForm`: mask the displayed address, explain the next step, expose sign-in/resend actions, and preserve only safe role/return context. Do not assert delivery.
- [ ] **Step 6: Run focused signup and existing return-context tests**: `node --test scripts/test-auth-hardening-signup.mjs scripts/test-auth-return-context.mjs`. Expect PASS with zero Supabase signup calls for mismatched passwords and no raw error leakage.
- [ ] **Step 7: Commit** as `fix(auth): validate signup confirmation and map errors safely`.

### Task 2: Confirmation Results and Truthful Resend

**Files:**
- Create: `src/app/auth/confirmation-status/page.tsx`
- Create: `src/components/auth-confirmation-status.tsx`
- Modify: `src/app/auth/confirm/route.ts`
- Modify: `src/app/auth/callback/route.ts`
- Lead modifies: `src/app/auth/actions.ts`
- Modify: `src/components/resend-verification-form.tsx`
- Modify: `src/app/auth/forgot-password/page.tsx` only to display recovery-specific expired-link guidance.
- Extend: `scripts/test-auth-token-hash-confirmation.mjs`
- Create: `scripts/test-auth-hardening-resend.mjs`

**Interfaces:**
- Confirmation status page accepts only bounded state values: `confirmed`, `invalid`, or `already-confirmed`; it accepts only a sanitized internal `returnTo`.
- `resendConfirmation(previous, formData): Promise<ActionState>` remains enumeration-neutral and never reports delivery. The client resend control owns a cooldown timer and pending/disabled state.
- Successful confirmation continues through the existing `verifyOtp` token-hash or cookie-bound PKCE exchange; provider errors and tokens never enter status-page URLs. The already-confirmed state is shown only when the current authenticated Supabase session confirms `email_confirmed_at`; a failed token alone is not evidence of prior confirmation.

- [ ] **Step 1: Add failing callback tests** for first confirmation success, token-hash and PKCE failures, consumed/expired links, recovery failure separation, already-confirmed state, returnTo sanitization, and zero token/provider diagnostics in redirect URLs.
- [ ] **Step 2: Run** `node --test scripts/test-auth-token-hash-confirmation.mjs` and verify the new confirmation-state assertions fail.
- [ ] **Step 3: Add the confirmation status page/component** with exact copy from the spec. Provide Sign in and Request another confirmation email on invalid signup links; preserve recovery-specific reset guidance; provide a Continue action for confirmed/previously-confirmed sessions.
- [ ] **Step 4: Change both callback routes** to redirect only to same-origin bounded status states after OTP verification or PKCE exchange. Keep mobile completion compatible with the existing `/auth/mobile-complete` flow and never skip explicit confirmation feedback.
- [ ] **Step 5: Make resend messaging truthful** in the server action. A no-error provider response means accepted/requested, not delivered; 429/rate limit maps to a wait message; unauthenticated copy remains neutral and no arbitrary email lookup is added.
- [ ] **Step 6: Add resend cooldown UI** with an immediate pending lock, visible remaining cooldown, cooldown retained after provider failure, and no rapid duplicate action call. Make cooldown testable with an injected clock or deterministic timer harness.
- [ ] **Step 7: Run focused callback/resend and existing origin tests**: `node --test scripts/test-auth-token-hash-confirmation.mjs scripts/test-auth-hardening-resend.mjs scripts/test-auth-email-preview-origin.mjs scripts/test-auth-preview-env-contract.mjs`. Expect PASS for token-hash, PKCE, enumeration-neutral copy, 429, rapid-click, and allowed-origin cases.
- [ ] **Step 8: Commit** as `fix(auth): make confirmation and resend states explicit`.

### Task 3: Authenticated Profile States and Fail-Closed Guards

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/account/page.tsx`
- Create: `src/components/account-profile-unavailable.tsx`
- Modify: all direct `getCurrentProfile()` consumers only where they need to distinguish missing from read failure; do not broaden unrelated account behavior.
- Extend: `scripts/test-admin-authorization-boundary.mjs`
- Create: `scripts/test-auth-profile-state.mjs`

**Base-HEAD call-site inventory:** `rg -n "getCurrentUser\(" src` at `387fd8045d0a8a643b5fe393fa126e9f978eb192` found 18 source call sites. The current helper turns both unauthenticated and Auth provider/read error into `null`; none of these callers throws from that condition. Preserve this behavior for every legacy caller except the account page, which will use the new explicit helper.

| Call site | Existing null handling | Auth read failure classification |
|---|---|---|
| `src/app/page.tsx` | Public Home continues without viewer-specific Garage resolution. | Safe public fallback; indistinguishable from signed out today. |
| `src/app/seller/[slug]/page.tsx` | Public seller profile renders without viewer personalization. | Safe public fallback; indistinguishable from signed out today. |
| `src/app/parts/[slug]/page.tsx` | Public listing renders without viewer-specific state. | Safe public fallback; indistinguishable from signed out today. |
| `src/app/compare/page.tsx` | Public compare results render without saved-part viewer state. | Safe public fallback; indistinguishable from signed out today. |
| `src/app/fit/[partId]/page.tsx` | Viewer-dependent fitting context follows the signed-out path; no protected role is granted. | Access remains closed; can look signed out. |
| `src/app/contact/page.tsx` | Public contact content renders without user-specific requests. | Safe public fallback; indistinguishable from signed out today. |
| `src/components/header.tsx` | Header renders anonymous navigation; null profile does not grant seller navigation. | Safe anonymous navigation; indistinguishable from signed out today. |
| `src/app/saved/actions.ts` | Returns `authRequired` and does not read/write saved parts. | Fails closed; action may prompt sign-in. |
| `src/app/garage-partner/page.tsx` | Renders the sign-in-to-apply state. | Fails closed; may look signed out. |
| `src/app/account-deletion/page.tsx` | Requires sign-in to submit deletion. | Fails closed; may look signed out. |
| `src/app/checkout/success/route.ts` | Redirects to account/orders with safe return context. | Fails closed; may redirect as if session expired. |
| `src/app/checkout/cancel/route.ts` | Redirects to account/orders with safe return context. | Fails closed; may redirect as if session expired. |
| `src/app/api/seller/listing-assistant/route.ts` | Returns HTTP 401 before seller lookup or AI work. | Fails closed; reports sign-in required. |
| `src/app/api/seller/donors/route.ts` | Null follows the endpoint's unauthenticated response path. | Fails closed; may report sign-in required. |
| `src/app/api/recently-viewed/route.ts` | Null follows the endpoint's unauthenticated response path. | Fails closed; may report sign-in required. |
| `src/lib/auth.ts` — `getCurrentProfile()` | Returns null without querying a profile. | Profile consumers see no profile; authorization remains denied. |
| `src/lib/auth.ts` — `requireUser()` | Redirects to the sign-in route. | Fails closed; may look signed out. |
| `src/app/account/page.tsx` | If either user or profile is null, renders the signed-out Auth form. | **Known false-logout defect**; this is the one page moved to explicit state handling. |

**Interfaces:**
- Lead-owned `getCurrentUserState(): Promise<CurrentUserState>`, where `CurrentUserState = {kind:"unauthenticated"} | {kind:"authenticated"; user:User} | {kind:"error"}`.
- Preserve the legacy `getCurrentUser(): Promise<User|null>` contract and its current null-on-provider-error behavior for unrelated consumers. Implement it as a compatibility wrapper over the shared read; do not make every caller throw.
- Lead-owned `getCurrentProfileState(user: User): Promise<CurrentProfileState>`, with `CurrentProfileState = {kind:"profile"; profile:Profile} | {kind:"missing"} | {kind:"error"}`.
- Account page uses the explicit state helpers and distinguishes unauthenticated, authenticated-with-profile, authenticated-profile-missing, authenticated-profile-read-error, and Auth-read-error. Only true unauthenticated state renders the signed-out Auth form.
- `requireSeller` and `requireAdmin` use the explicit profile state for role authorization; grant access only for `kind:"profile"` with the required role. Missing/error states fail closed. `requireUser` and existing unrelated callers retain legacy helper behavior.

- [ ] **Step 1: Add failing profile-state tests** for unauthenticated session, Auth-read error, profile present, profile missing, and profile query error; assert profile error and missing profile remain distinct.
- [ ] **Step 2: Add failing guard tests** asserting seller/admin access is denied for missing and errored profile reads, and no role or profile is manufactured.
- [ ] **Step 3: Run** `node --test scripts/test-auth-profile-state.mjs scripts/test-admin-authorization-boundary.mjs` and confirm failure on current null/error conflation.
- [ ] **Step 4: Lead implements the scoped read contract** in `src/lib/auth.ts`: add `getCurrentUserState()` and `getCurrentProfileState(user)`; preserve the legacy `getCurrentUser()` behavior as a compatibility wrapper. Keep request caching and do not make legacy callers throw.
- [ ] **Step 5: Lead updates `requireSeller` and `requireAdmin`** to use `getCurrentProfileState` and fail closed for missing/error states without changing the legacy `requireUser` contract.
- [ ] **Step 6: Agent B updates `AccountPage` and its unavailable-state component** to use the explicit helpers: unauthenticated users see sign-in; Auth/profile read errors show retry; genuinely missing profile stays authenticated and shows retry plus support/recovery guidance. Do not call or add profile repair. Repository's `private.handle_new_user()` trigger runs only on Auth user creation and is not a repair mechanism.
- [ ] **Step 7: Run focused profile/authorization and existing auth-return tests**: `node --test scripts/test-auth-profile-state.mjs scripts/test-admin-authorization-boundary.mjs scripts/test-auth-return-context.mjs`. Expect PASS with protected content absent for every non-authorized state.
- [ ] **Step 8: Commit** as `fix(auth): distinguish authenticated profile failures`.

### Task 4: Account Dashboard Optional-Read Isolation

**Files:**
- Modify: `src/components/account-dashboard-content.tsx`
- Modify: `src/lib/data/buyer-account.ts`
- Modify: `src/lib/data/marketplace.ts` only for error-preserving saved-ID reads used by the dashboard.
- Create: `src/components/account-dashboard-retry.tsx`
- Create: `scripts/test-auth-dashboard-degradation.mjs`

**Interfaces:**
- Optional reads return a discriminated result or throw a typed read error; UI converts failures into explicit unavailable states, never `0`, `null`, “Join”, or “Finish setup” when those values would imply a successful empty read.
- Count display accepts `number | null`; null renders an unavailable marker and explanatory text.
- Retry uses `router.refresh()` to rerun server reads without changing auth/session or role state.

- [ ] **Step 1: Add failing tests** for an individual count query error, recently viewed query failure, saved-ID failure, seller lookup failure, and garage-partner lookup failure. Assert account shell and other available sections remain rendered, no failed read is shown as zero/empty/setup-needed, and retry control is present.
- [ ] **Step 2: Run** `node --test scripts/test-auth-dashboard-degradation.mjs` and verify the existing fallback behavior fails the assertions.
- [ ] **Step 3: Preserve query errors in `getBuyerAccountCounts`** per counter so successful counts remain visible and failed counts are marked unavailable. Preserve failures from recent-list and saved-ID reads for the dashboard boundary.
- [ ] **Step 4: Isolate optional dashboard reads** in `AccountDashboardContent`. Render unavailable/retry states at the affected card or section. Keep role/identity authorization outside optional catches.
- [ ] **Step 5: Add the client retry control** using `router.refresh()`; expose accessible status text and a disabled/pending state while refreshing.
- [ ] **Step 6: Run focused dashboard tests and existing account validators**: `node --test scripts/test-auth-dashboard-degradation.mjs scripts/test-garage-null-profile-reads.mjs` and `npm run validate:account-deletion-e2e` (static guard only; do not execute destructive E2E).
- [ ] **Step 7: Commit** as `fix(account): isolate optional dashboard read failures`.

### Task 5: Password Reset Lifecycle and Android Return

**Files:**
- Modify: `src/components/reset-password-form.tsx`
- Lead modifies: `src/app/auth/actions.ts` only for safe error mapping and reset session handling.
- Recovery-specific expired-link guidance in `src/app/auth/forgot-password/page.tsx` is owned by Task 2.
- Modify: `src/app/auth/mobile-complete/page.tsx` only if confirmation/recovery return state needs an explicit user-visible mobile result.
- Extend: `scripts/test-current-password-change.mjs`
- Create: `scripts/test-auth-reset-lifecycle.mjs`

**Interfaces:**
- Keep `updatePassword(previous, formData): Promise<ActionState>` server-side confirmation comparison and require a valid recovery session before changing the password.
- Reset errors use the shared auth error mapper; expired recovery displays recovery-specific instructions and a fresh reset request action.
- Mobile password-updated/confirmed states keep the existing `/auth/mobile-complete` contract and must not strand the Android wrapper.

- [ ] **Step 1: Add failing tests** for client mismatch feedback, server mismatch rejection, expired recovery session, safe generic provider errors, recovery-specific expired-link message, mobile return state, and sanitized returnTo.
- [ ] **Step 2: Run** `node --test scripts/test-auth-reset-lifecycle.mjs scripts/test-current-password-change.mjs scripts/test-auth-return-context.mjs` and verify the new lifecycle assertions fail where behavior is missing.
- [ ] **Step 3: Add immediate client mismatch feedback** while retaining server-side validation as the security boundary. Keep password values out of error copy and telemetry.
- [ ] **Step 4: Verify recovery-specific expired-link guidance** from Task 2 without changing the neutral unknown-email response.
- [ ] **Step 5: Verify Android completion paths** for signup confirmation and password reset; preserve existing mobile completion state and `MobileAuthReturn` semantics.
- [ ] **Step 6: Run focused reset/mobile tests**: `node --test scripts/test-auth-reset-lifecycle.mjs scripts/test-current-password-change.mjs scripts/test-auth-return-context.mjs scripts/test-auth-token-hash-confirmation.mjs`. Expect PASS without claiming provider email delivery.
- [ ] **Step 7: Commit** as `fix(auth): harden password reset and mobile return`.

### Task 6: Integrated Auth QA, Preview, and Fresh External E2E

**Files:**
- Modify: `docs/test-runs/2026-10-07-auth-hardening.md` (create as the final evidence report).
- No Production configuration or credentials are changed.

**Interfaces:**
- Evidence records exact branch SHA, CI checks, Preview deployment ID/URL, Preview Supabase project ref, and PASS/FAIL/BLOCKED state for each gate.
- Auth PASS requires genuine fresh external mailbox evidence; mocks and a reused confirmed account do not qualify.
- Stacked merge target remains `codex/dvsa-integration`; PR #10 stays open.

- [ ] **Step 1: Run focused Auth tests**: `node --test scripts/test-auth-hardening-*.mjs scripts/test-auth-token-hash-confirmation.mjs scripts/test-auth-email-preview-origin.mjs scripts/test-auth-preview-env-contract.mjs scripts/test-auth-return-context.mjs scripts/test-current-password-change.mjs scripts/test-admin-authorization-boundary.mjs`.
- [ ] **Step 2: Run full automated and required baseline checks**: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run validate:dependencies`, `npm run validate:launch-baseline`, `npm run validate:android-rc`, plus `git diff --check`. Run other applicable validators from AGENTS.md if changed code touches their contracts.
- [ ] **Step 3: Complete independent code review** on the auth branch; resolve all actionable findings and rerun affected tests.
- [ ] **Step 4: Push `codex/auth-hardening` and open its stacked PR** targeting `codex/dvsa-integration`; keep the PR unmerged while Preview and external E2E gates run.
- [ ] **Step 5: Deploy the exact `codex/auth-hardening` HEAD to Vercel Preview** only. Verify deployment SHA, Home 200, health 200, and Preview Supabase project ref.
- [ ] **Step 6: Complete the external Supabase configuration gate** by manually reading the exact Preview project's Site URL and all Additional Redirect URLs. Record values and callback-path fitment without changing Production. If unavailable or incorrect, mark BLOCKED and stop before claiming hosted redirect PASS.
- [ ] **Step 7: Complete fresh external Auth E2E** with a never-before-confirmed external mailbox: signup, receive email, click once, correct Preview, explicit success, profile access, logout/login; also resend before confirmation, rapid resend, used link, forgot/reset, old-password rejection/new-password acceptance, wrong password, and password mismatch. If SMTP/provider restrictions prevent this, record the exact owner action and mark BLOCKED; do not retry spam or claim PASS.
- [ ] **Step 8: Review and merge the stacked Auth PR** only after steps 1–7 PASS, targeting `codex/dvsa-integration`. Do not target `main` or Production.
- [ ] **Step 9: On the new PR #10 HEAD, rerun full integrated automated regression**, deploy that exact HEAD Preview, then conduct manual integrated QA for signup/confirmation/login/reset; Garage current-vehicle switching; DVSA SE66 PPO; DVSA MT71 JZG; compatibility ON/OFF; and refresh/persistence. Keep PR #10 open until every item passes.
- [ ] **Step 10: Record final evidence** in `docs/test-runs/2026-10-07-auth-hardening.md`, including remaining blockers and the Production email/link-scanner prerequisites: controlled custom transactional SMTP, verified sender domain, SPF, DKIM, DMARC, disabled link tracking where it rewrites auth links, confirmation/reset deliverability, and scanner/prefetch assessment. This is a release checklist only; do not configure Production.
- [ ] **Step 11: Commit the evidence report** as `docs(auth): record auth hardening release evidence`.

## Plan self-review

- Spec coverage: signup, callback success/failure, resend, error mapping, profile missing/transient state, fail-closed roles, optional dashboard failures, reset, same-origin return paths, Preview URL configuration, fresh external E2E, Production mail/link-scanner gate, and stacked merge sequence all map to tasks above.
- Profile safety: current signup trigger is documented as creation-only; no profile-repair path is used or added.
- Enumeration: resend and reset remain neutral; signup does not add an existence query or a new provider-semantic channel.
- Stacked order: Auth Preview and fresh external E2E happen before merging into DVSA; integrated PR #10 QA happens only after that merge.
- No product code has been changed while preparing this plan.
