# Photo integrity Preview QA — 11 September 2026

Status: implementation reviewed and locally verified; Preview rollout and database execution gates remain open. This is not a completed QA sign-off.

## Fixture provenance

Created using the normal QA Seller listing form on branch Preview at commit `085d9b9381ebd2da6c68298d100b3ceba122a385`, before the photo fix. The form returned `/dashboard?created=1`, and the dashboard identifies SecondPart QA Seller.

- Part: `760fdafa-e589-449e-9296-397f76c74bd2`.
- Seller: `58ecccc3-5162-4826-9c3f-81dbd92a6007`.
- Title: `[QA TEST] Photo integrity fixture`.
- Unpublished `draft`, quantity 1, price 100 pence; no checkout or Stripe operation.
- Description explicitly identifies synthetic QA and excludes real sale.
- Category chosen through the form: Electrical & Lighting → Starting & Charging → Charging Components.
- Two copies of `docs/test-runs/fixtures/qa-test-part.png` uploaded through the real image input. Supabase readback confirms two photo rows.
- No compatibility claims or fabricated part identifiers were added.

The existing sold payment fixture and its transaction remain untouched. Keep this draft as a documented disposable photo fixture until all tests and cleanup are complete. Database assertions must use a guarded transaction with rollback; Storage byte operations must use the Storage API.

## Implementation evidence

- Independent specification/security/quality review approved after fixing the authorized parent-listing deletion cascade. Exact ownership context is captured before the parent disappears.
- Fresh full regression suite: 61/61 pass, including 38 photo action/worker/privacy/SQL-contract checks. These adapter and structural checks do not replace actual PostgreSQL/Storage execution.
- Lint, typecheck, production build and all 14 repository targeted validators passed. The final review change affected SQL and its contract test only; the full test suite and diff check were rerun afterward.
- Live preflight: three attached images, zero owner/path mismatches, zero detached-owner images; cleanup migration is absent. Existing photos remain intact.

## Pending evidence

- New app fails closed before migration availability.
- Apply migration only to the confirmed Preview project, inspect functions/grants/policies.
- Transaction rollback tests for reserved/last-active-photo/ownership/retired-path guards.
- Two-session parent-lock check without committing inventory changes.
- Browser removal confirms metadata, private cleanup record and physical Storage result.
- Account-deletion worker failure/retry and untracked-orphan cleanup tests.
- Regression suite, lint, typecheck, build, relevant validators, CI and exact-HEAD aliases.
