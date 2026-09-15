# SecondPart Auth password hardening evidence — 2026-09-15

## Scope

This evidence records the password-policy hardening performed for the QA Supabase project and the matching application changes on `rebuild-nextjs`.

No Production environment, real customer password, or real customer account was used.

## Supabase Auth configuration

The project Email Auth settings were reviewed in Supabase Dashboard.

Confirmed changes made by the project owner:

- minimum password length increased from 6 to **8 characters** and saved;
- **Require current password when updating** enabled and saved;
- **Secure password change** left disabled because SecondPart does not yet implement the Supabase nonce-based reauthentication flow;
- **Prevent use of leaked passwords** could not be enabled because Supabase rejected the setting on the current plan and explicitly requires Pro Plan or above.

After the saved configuration change, Supabase Security Advisor was refreshed. The only Auth-specific advisor warning remains:

- `auth_leaked_password_protection` — **Leaked Password Protection Disabled**.

That warning is classified as **EXTERNAL / PLAN-LIMITED** rather than an engineering PASS or application defect.

## Application change

SecondPart already enforced a minimum of 8 characters in signup and recovery password flows. A separate authenticated password-change flow was added to `Account → Security & account` so users can change a password while providing the existing password.

The new flow:

- is available only behind `requireUser('/account/security')`;
- collects `currentPassword`, replacement password and confirmation;
- rejects missing current password;
- rejects replacement passwords shorter than 8 characters;
- rejects mismatched confirmation;
- rejects reusing the same value as the current password at the application layer;
- calls Supabase Auth `updateUser` with both `password` and the installed SDK's `current_password` field;
- returns a bounded error message when Supabase rejects the update;
- leaves the recovery-link flow unchanged.

The original recovery flow remains `resetPasswordForEmail(...)` → recovery session → `updateUser({ password })`, so recovery does not depend on knowing the old password.

## TDD and debugging evidence

RED commit:

- `cb49ca4d0771d1c31c9fb999f350b779a7900a1f`
- CI `35020989403`
- result: 548 PASS / 3 FAIL, all three failures exactly on the missing current-password change page/component/action.

Initial GREEN implementation exposed a type mismatch against the installed `@supabase/supabase-js 2.114.0` contract. CI reported:

`TS2561: 'currentPassword' does not exist in type 'UserAttributes'. Did you mean 'current_password'?`

The implementation and regression test were then corrected to the actual installed SDK contract rather than bypassing TypeScript.

Final verified application SHA:

- `100d278b324c74b7c08f106e914982d95f0f35dc`
- GitHub Actions run `35021522991`: **SUCCESS**
- full suite: **551/551 tests PASS**
- lint: PASS (pre-existing warnings only)
- typecheck: PASS
- all release validators: PASS
- production build: PASS
- true last-stock concurrency: PASS
- isolated 100k marketplace PostgreSQL scale proof: PASS

## Preview evidence

Exact Preview deployment:

- deployment `dpl_22p93aEfG35ipxor1fvb9QbJZVzP`
- exact SHA `100d278b324c74b7c08f106e914982d95f0f35dc`
- state: READY

Anonymous request to `/account/security` remained account-gated and redirected to the sign-in-required Account flow; the route did not become public as a side effect of the new form.

Runtime error/fatal query on the exact deployment returned no matching logs in the checked window.

## Classification

- **VERIFIED:** minimum 8-character application/UI contract, authenticated current-password change flow, matching installed Supabase SDK contract, full CI/build/Preview boundary.
- **CONFIGURED BY OWNER:** Supabase `Minimum password length = 8` and `Require current password when updating` were saved in Dashboard.
- **DELIBERATELY NOT ENABLED:** `Secure password change` because nonce-based reauthentication is not implemented and is not required for this RC hardening step.
- **EXTERNAL / PLAN-LIMITED:** leaked-password protection; Supabase requires Pro Plan or above.
