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
