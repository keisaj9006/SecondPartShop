# Authentication return context QA — 12 September 2026

Status: baseline defect verified; correction and post-fix checks pending.

Anonymous GET on exact-HEAD Preview `d243fdb` for `/?q=qa-missing-alternator-20260912&cv=0fe12974-0cc5-4244-b2aa-aa96b80e7c6a&cy=2017&cf=PETROL&ce=1400&fit=1` returned HTTP 200. Its Sign in to find this part link was `/account?returnTo=%2F%23marketplace`, losing query and vehicle context.

Source inspection confirms signUp ignores supplied returnTo in both email callback and immediate-session redirects. The AuthForm passes that value in a hidden input, but both resend links discard it too. No signup, email, reset or external message was sent during this audit.

Acceptance: preserve a sanitized internal destination through normal signup, confirmation and resend; retain existing role defaults and terms validation; reject external redirect attempts. Inspect the public Find My Part link and auth UI in Preview without sending unsolicited emails. Real email deliverability remains grouped RC/provider QA.

## Implementation and local evidence

Signup now uses safe returnTo in both its email callback and immediate-session redirect. AccountPage/AuthForm preserve absence separately from explicit /account, so seller signup retains the existing /dashboard default. Both resend links, verify-email, its form/action and confirmation-error retry carry safe intent. Find My Part receives the normalized current marketplace context, including pagination/cursor where present. Password-reset behavior, roles and consent validation are unchanged.

Synthetic RED: 11 tests, 9 failed and 2 passed. GREEN: 11/11 auth boundary tests and 22/22 combined auth/navigation tests; full suite 95/95. Lint and typecheck passed; launch-baseline and notifications validators passed. No real email/account was created. Independent review/build/Preview acceptance remain pending until recorded below.

Independent review found an additional P1 in the reused safeInternalPath helper: dot-segment normalization could turn a nominally internal path into a protocol-relative destination. Synthetic actual signup and successful callback tests reproduced the external redirect for literal and encoded dot segments. Initial 95-test/build success is not acceptance; fix round 1 and rereview are required before release.

Review round 1 repaired the shared helper by rejecting normalized protocol-relative destinations and validating the normalized origin. Regression coverage includes literal/encoded dot segments, backslash normalization and the dummy validation-domain collision. The direct helper, actual immediate signup and successful callback all reject those values while safe query/hash destinations remain intact. Independent scoped rereview approved specification compliance and quality. Fresh focused auth tests: 13/13; lint/typecheck passed with only the three existing mobile-shell lint warnings.
Final post-review full suite: 97/97 passed; production build passed. This includes the repaired normalized-destination guard. Preview acceptance remains pending until the exact release below is verified.
All 14 repository validators were rerun after the final security fix and passed; git diff --check passed.
