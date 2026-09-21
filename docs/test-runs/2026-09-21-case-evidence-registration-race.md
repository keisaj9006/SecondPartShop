# Case evidence registration/cleanup race — 21 September 2026

## Defect and repair

The pre-existing cleanup outbox locks a generated Storage path while granting deletion authority, but evidence registration did not participate in that lock. A worker could select an unattached queued path, a delayed registration could attach it, and Storage removal could then destroy attached evidence. Completed cleanup paths could also be reattached.

The new migration adds a BEFORE INSERT / UPDATE OF storage_path trigger. It takes the same transaction advisory lock and rejects any pending or completed cleanup tombstone. Registration that commits first causes queueing to refuse deletion authority. Queueing that commits first permanently retires that generated path. Existing authorization, participant checks, RLS and service-only cleanup RPCs are preserved; upload retry uses a fresh generated path.

## Verification

- RED: three child assertions reproduced delayed registration, completed-path reattachment and storage-path update defects.
- GREEN: 17 focused cleanup tests pass; full suite 660/660 PASS, no skips.
- Real PostgreSQL 17.10, independent connections: both operation orderings were observed waiting on a lock and passed. Local server stopped afterward.
- Independent review found no blocking implementation defect; requested concurrency proof was added.
- Lint passes with four pre-existing warnings; typecheck, commerce and account-deletion validators pass.
- CI includes a new isolated PostgreSQL 17 evidence concurrency job.

## Hosted rollout prerequisites

Fresh readback: private.case_evidence_cleanup absent; zero registered case-evidence rows. Latest hosted migration is 20260921084303 provider_dispute_reversal_recovery. Therefore no old outbox workers can already own deletion intent. Deploy source 20260918154500 and new 20260921140000 together atomically, then read back privileges, trigger and empty queue. Never deploy the old outbox alone now that this race is known. No storage objects need removal for schema validation.

This is a SQL invariant/concurrency proof, not a real Storage failure/retry E2E or destructive account deletion sign-off.

## Hosted deployment and integration

- PR #2 merged into rebuild-nextjs as fbe92ec; main unchanged.
- Feature CI run 35606326935: all five jobs PASS (validate, last-stock-concurrency, marketplace-scale-postgres, dispute-reversal-concurrency, case-evidence-concurrency). The initial run stopped at whitespace validation for a trailing blank line in the new harness; corrected before the successful run.
- Local production build PASS. Full branch diff whitespace check PASS after correction.
- Hosted migration 20260921133420 / case_evidence_cleanup_outbox_with_registration_guard atomically applied the exact source SQL from 20260918154500_case_evidence_cleanup_outbox.sql and 20260921140000_case_evidence_cleanup_registration_guard.sql. This explicit many-to-one mapping supersedes the earlier not-deployed boundary; do not blindly replay either source migration or repair migration history.
- Readback: RLS enabled; no direct SELECT/INSERT/UPDATE/DELETE for anon, authenticated or service_role; four cleanup RPCs service_role-only; trigger helper directly executable by none of those roles; SECURITY DEFINER and empty search_path retained.
- Trigger active on INSERT and storage_path UPDATE. Queue empty; zero queue/evidence overlaps; service_role queue read succeeds with zero rows.
- No Storage object deletion was performed. Existing deployed application already supports the outbox, so no application redeploy or webhook pause was necessary.

Remaining: actual Storage failed-delete/retry scenario and normal disposable-account deletion E2E still need distinct proof.
