# Seller photo cleanup (SEC-01)

The database authorizes metadata removal and records the exact owned Storage path in a private outbox in the same transaction. The service worker removes bytes through the Storage API and acknowledges success. Failed removal or acknowledgment stays retryable. Both current maintenance routes process at most 50 pending photos per invocation; failed paths defer general maintenance retries by five minutes. Immediate and privacy attempts can retry an exact path sooner.

Authorized non-reserved parent listing deletion captures photo cleanup context before the parent disappears. Its FK cascade must find exact pending owner/part/path authority in the private outbox; a missing parent alone never bypasses authorization. Reserved parent deletion remains blocked. The rollback SQL QA covers both cases and verifies seller context survives the cascade.

The outbox has no cascading foreign keys. Completed rows prevent path reuse until account deletion safely removes Auth identity, drains pending work and erases identifying tombstones. Account deletion discovers pending ordinary-photo cleanup using retained owner/seller context, including after profile detachment. It also scans the validated UUID owner prefix through Storage.list/remove, including untracked upload leftovers. Each pass removes at most 500 such objects with at most 1,000 listing calls and 16 folder levels; an incomplete pass blocks completion and retries from page zero. Storage list/remove failure blocks completion. Database finalization independently checks that no owner-prefix Storage metadata remains (read only).

## Rollout and rollback

1. Review live policies/migration history and the ownership preflight. All existing image paths must start with their actual owner's UUID and exact part UUID. The migration aborts on mismatches; inspect and repair such data through an authorized separate operation, never relax the check. Also inspect any historical images with detached owners. No migration has been applied by the implementer.
2. Deploy this app version first. Photo upload/delete checks the service-only queue RPC before mutating; if the migration is absent, those actions temporarily fail with a retryable message. Existing reads remain available. Maintenance may report the missing RPC until the migration lands. This transition does not claim SEC-01 closed while the old Storage policies remain active.
3. Apply `20260911213522_secure_part_image_cleanup.sql` atomically. It installs database/outbox authority, protects attachment and retirement, replaces upload authorization and denies authenticated Storage UPDATE/DELETE. It does not mutate Storage objects. No second enforcement migration or permissive policy gap is required.
4. Verify the new app and migration together. Old app versions cannot delete/overwrite bytes once the restrictive policies land; old failed-upload cleanup may leave an orphan, so ensure old workers/deployments are drained. Keep the current maintenance scheduling; verify at least one route runs regularly.
5. Rollback preference: fix forward while retaining the outbox and restrictive Storage policies. Rolling back app code makes old photo-delete operations fail safely; the old privacy worker cannot finalize if new cleanup intent remains. Do not drop the outbox or restore direct Storage DELETE/UPDATE to recover UI availability. A full database rollback needs drained pending work, preserved tombstones, and an explicitly reviewed alternative authorization design.

## Local verification

Run `node --test scripts/test-part-image-cleanup.mjs scripts/test-part-image-migration.mjs`, `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check`. The migration contract guards are structural checks, not proof of PostgreSQL concurrency. The controller runs the broader commerce/privacy/monitoring validation suite.

`scripts/qa-part-image-cleanup.sql` is a DML-only transaction that always rolls back. It requires a disposable draft listing titled `SEC01-QA-...` or `[QA TEST] Photo integrity fixture`, its seller owner UUID and no orders. It verifies exact intent, last active photo protection, pending/completed retirement, immutable paths, wrong-owner rejection and reserved RLS zero-row behavior. It does not create or delete Storage objects. Do not run it with real member data.

## Two-session disposable concurrency QA

Use an already-created disposable seller and draft/active parts with generated owned paths. Record each session's backend PID and use a short `lock_timeout` to establish blocking. Every test session must use `BEGIN` and end with `ROLLBACK`; never use real orders or provider calls to manufacture fixtures.

| Scenario | Session A | Session B and expected result |
|---|---|---|
| Parent serialization | As service/admin: `SELECT id FROM public.parts WHERE id = '<QA part>' FOR UPDATE;` | Set authenticated role/JWT for the disposable owner; delete one image. It blocks on the parent (confirm with `pg_blocking_pids`). Release A with rollback, then B can proceed. Roll back B. |
| Reserved checkout boundary | As service/admin, lock the QA parent as above, then set its status to reserved inside that transaction. | Concurrent authenticated delete waits. Rollback A proves the wait; a separate already-reserved fixture verifies rejection. A committed disposable reservation and resulting rejection requires a separate explicitly approved fixture change; this rollback-only protocol does not pretend uncommitted reserved state can be observed. |
| Two active-photo removals | Two images on an active QA part; A deletes one metadata row and holds the transaction. | B deleting the other blocks on parent. Rolling A back permits B; roll B back. The single-session QA proves final-image rejection. To prove two committed removals leave one image, use an explicitly approved disposable fixture test with A committed and B rejected. |
| Orphan retirement versus attachment | A calls service-only `queue_orphan_part_image_cleanup` for a generated owned, unreferenced QA path and holds transaction. | Authenticated B inserts the same path into part_images: blocks on parent/path lock. Roll A back and B proceeds; roll B back. Repeat with attachment held in A and orphan queue in B; B blocks. Separate sequential QA proves a committed retirement prevents attachment and an attached path cannot be orphan-queued. |

For actual Storage API QA, confirm public read and unique `upsert:false` upload; authenticated DELETE and UPDATE/upsert must fail on an attached image and a retired path cannot be uploaded. Do not issue SQL mutations against `storage.objects`.

Force a Storage/API failure only in a controlled test adapter or explicitly configured disposable QA run: metadata deletion remains successful, the outbox remains pending, maintenance later completes it, and repeated absent-object removal is harmless. Confirm an account-deletion request cannot complete while that pending path exists; retry after Storage recovery, including after identity detachment, must drain it and remove identifying tombstones.

## Known boundaries

The outbox durably covers authorized metadata deletion and successfully queued failed attachments. If an upload succeeds but both attachment and the orphan-queue RPC fail (for example a database outage), the app preserves the attachment error and fails closed on Storage removal. Later privacy processing still discovers that owner's untracked objects via its validated prefix scan. Ordinary cleanup of such unqueued leftovers before account deletion remains an operational recovery concern. Provider calls are not inside a database transaction. Concurrent worker removals are safe because retired paths cannot be reused; a lost response is retried. Supabase's Storage API must confirm that removal of an already-absent key succeeds in the target environment.
