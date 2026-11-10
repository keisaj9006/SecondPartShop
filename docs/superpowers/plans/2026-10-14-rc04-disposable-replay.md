# RC-04 Disposable Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a deterministic, auditable disposable replay and a safe decision on the pending review-ready migration without changing hosted Supabase.

**Architecture:** Derive a manifest from the RC-02 mapping and RC-03 source. Run every mapped source file in an isolated PostgreSQL engine with explicit Supabase service prerequisites, logging any incompatibility. Compare critical catalog metadata to read-only hosted readback, then exercise the candidate trigger against synthetic cases. Report all limitations and deployment/rollback gates.

**Tech Stack:** Node.js, PGlite/PostgreSQL, Supabase catalog SELECTs, existing release validators.

**Spec:** GitHub issue #21 and `docs/test-runs/2026-10-14-rc03-migration-reconciliation.md`.

## Global Constraints

- No hosted DDL/DML, `db push`, `apply_migration`, `migration repair`, or ledger edits.
- No changes to `main`, Production, RC-01/RC-02 snapshots, orders, payment data, or accounts.
- Do not claim full canonical replay if local engine or service shims differ from hosted Supabase.

## Review Focus

- Duplicate timestamp ordering and repeated names must be explicit and stable.
- Review-ready notifications must have exactly two intended recipients, at most once each.
- Failed or partial replay must not silently continue or become a PASS.
- Function privileges, trigger metadata, RLS and `search_path` must be compared before a deployment GO.
- Rollback must preserve auditability and avoid deleting real notifications.

### Task 1: Manifest and clean replay

- [x] Build a deterministic manifest from RC-02 mapping, including four timestamp collisions, combined hosted statements, and historical review-ready exclusion.
- [x] Implement a disposable replay runner with preflight, clean-state contract, per-entry evidence and fail-fast SQL execution.
- [x] Run it and classify each failure; remedy only legitimate local prerequisite gaps. Native PG17/Supabase service verification is an RC-05 external gate.

### Task 2: Hosted catalog comparison

- [x] Read critical hosted functions, triggers, policies, grants and extension state using SELECT only.
- [x] Compare available local catalog evidence; flag version/service limitations.

### Task 3: Review-ready rehearsal

- [x] Add focused cases for eligibility timing, retries, recipient correctness, existing dedupe, and security metadata.
- [x] Run candidate only in a disposable database; record readback and rollback rehearsal.

### Task 4: Checkpoint and verification

- [x] Write RC-04 evidence, deployment and rollback plan, blocker table, and RC-05 steps.
- [x] Run focused tests, release validators, `git diff --check`, lint, typecheck and build if dependencies work.
- [x] Commit only isolated repository changes; report exact branch and commit.
