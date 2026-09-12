# Photo integrity Preview QA — 11 September 2026

Status: implementation deployed; the browser and transactional database checks below passed. Remaining provider/concurrency gates are explicit. This is not a full release sign-off.

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
- Pre-migration live preflight: three attached images, zero owner/path mismatches, zero detached-owner images; cleanup migration was absent at that point. Existing photos remained intact.

## Preview execution

- Commit `254d5a232fe3c31547d1c941534d1a52e05cf6ea`; CI [34652531245](https://github.com/keisaj9006/SecondPartShop/actions/runs/34652531245) succeeded. Preview `dpl_29Ac7cs6xwZappQSv9vNbD1fQpVY`, `second-part-shop-k6rfij0to-joannakwapis11-5369.vercel.app`, READY with that SHA. Both stable and branch aliases were read back against this deployment while it was HEAD.
- Before migration, the real Delete product photo action failed closed. UI used the generic error boundary with Try again; database and Storage still had both fixture photos. No custom rollout error text was visible.
- Applied `20260911213522_secure_part_image_cleanup.sql` only to the confirmed Preview Supabase project. Applied version is `20260911221033`, name `secure_part_image_cleanup`. Record the mapping; do not replay the local timestamp as another migration.
- Live worker RPCs are SECURITY DEFINER with empty search path and service-role-only execution. Authenticated Storage DELETE/UPDATE policies are restrictive; upload retains ownership and retirement guards.
- `scripts/qa-part-image-cleanup.sql` ran successfully and rolled back. It exercised exact cleanup ownership, final-active-photo rejection, reserved child/parent zero-row deletion, immutable paths, pending/completed path retirement and authorized parent cascade.
- A separate guarded rollback transaction also verified unauthorized parent deletion creates no cleanup intent, then authorized deletion cascades two photos and preserves exact owner/seller/part context for both. The real draft and its photos survived rollback.
- Authenticated DELETE and UPDATE query plans for the attached QA Storage object resolve to `One-Time Filter: false`. These were EXPLAIN only, without ANALYZE: no SQL Storage mutation was executed. This is database policy evidence, not an HTTP Storage negative test.
- Real browser deletion removed photo `3c9ce523-7af7-48fa-a518-a9c0dd0e9b4e` (position 1). The database changed from two images/objects to one; its exact private cleanup row was completed with failure count 0. Public Storage GET for the removed key returned HTTP 400 with provider `statusCode:404`, `NoSuchKey`.
- A fresh upload through the normal edit form created photo `d21f1bbd-8ae5-42c3-a016-e98c97cfa602`, position 1. Database/Storage returned to two images/objects; its public GET returned 200, image/png, 13,537 bytes. The fixture stays an unpublished draft for outstanding QA.
- `scripts/qa-part-image-privacy-finalization.sql` passed and rolled back. A random nonexistent identity and synthetic request/outbox row proved detached path discovery, rejection while cleanup is pending, completion after acknowledgment and removal of identifying tombstones. No real Auth/profile/seller identity was deleted. Worker adapter tests separately cover failed list/remove, detached retries and bounded 605-object cleanup.
- Runner control: a deliberate read-only division-by-zero statement before rollback/trailing success returned `isError:true`, SQLSTATE 22012, and no success row. The connector aborts on that error. Reusable SQL QA must likewise stop on any error; a trailing label alone is not proof.

## Remaining gates and honest limits

Follow-up: [12 September recovery runner evidence](2026-09-12-photo-recovery.md) records synthetic verification and the protected-credential blocker. Actual provider recovery remains unexecuted; no additional Storage mutation occurred in that attempt. The fixture now has three photos after the separately verified Task 6 Draft retry.

- The attempted two-session SQL check did not establish concurrency: the connector returned the lock-holder result before the observer saw an active session. The dependent deletion was not attempted. Use two independently connected PostgreSQL sessions for the runbook's committed concurrent outcomes; do not label this PASS.
- Actual authenticated HTTP Storage DELETE/UPDATE and retired-path upload rejection, absent-object removal retry, and a controlled provider outage followed by maintenance recovery remain unexecuted. Current evidence is the deployed policy query plan, actual normal upload/delete, SQL triggers and adapter tests.
- A real disposable account-deletion Storage/Auth E2E is still separate from the synthetic transaction and adapter tests. Existing QA Buyer, QA Seller, Moira and payment history were preserved.
- `vercel.json` declares maintenance scheduling, but Vercel invokes cron jobs only in Production, not Preview. No automatic Preview retry schedule was established in this test. A photo-only recovery batch must use a reviewed trusted exact-path worker runner; broad maintenance also processes identities/payments and needs a separate full-workload preflight. Do not touch Production to satisfy this gate. [Vercel documentation](https://vercel.com/docs/cron-jobs).
