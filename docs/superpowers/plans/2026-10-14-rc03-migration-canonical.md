# RC-03 Migration Canonical Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deployed five-function repair and the confirmed missing review notification auditable in source without writing to the hosted database.

**Architecture:** Preserve all earlier migration files and their audit trail. Adopt the exact already-hosted 8 October SQL under its hosted version/name. Add a separate forward-only review notification migration, a static integrity test, and a row-by-row reconciliation report. Hosted reconciliation remains a later approval gate.

**Tech Stack:** PostgreSQL/Supabase migration SQL, Node.js built-in test runner, Git.

**Spec:** GitHub issue #20 and `docs/test-runs/2026-10-14-rc02-migration-reconciliation.md` in the RC-02 worktree.

## Global Constraints

- Base the isolated branch on `b35864cc87714f7a16703be53985644758f7b410`.
- Hosted Supabase access is SELECT-only. No provider, order, account, Production, or `main` mutation.
- Do not renumber earlier applied migrations or delete RC-01/RC-02 snapshots.
- An exact source mismatch must stop source adoption.

## Review Focus

- The adopted file must equal the hosted ledger statement byte-for-byte after newline normalization, removal of the original outer transaction wrapper and final blank-line normalization.
- A fresh replay must not grant the five privileged functions to `anon`; `claim_account_deletion_request` must remain service-only.
- The review notification must fire only after completed fulfilment and released funds, with distinct buyer/seller dedupe keys.
- Existing historical review notification source and the forward migration must be idempotent in sequence.
- Duplicate versions/names must remain visible in the reconciliation report and must block automatic `db push`.

---

### Task 1: Recover and adopt exact five-function SQL

**Files:** Create `supabase/migrations/20261008130523_account_deletion_checkout_fitting_serialization.sql`; test in `scripts/test-rc03-migration-source.mjs`.

- [ ] Verify Git blob `d017345:docs/test-runs/2026-10-08-deletion-checkout-guard.sql` equals the current source file.
- [ ] Verify its body equals hosted ledger statement `20261008130523` after omitting only outer `BEGIN/COMMIT` and normalizing CRLF.
- [ ] Verify five live signatures, `SECURITY DEFINER`, empty search paths, privileges and definition hashes.
- [ ] Copy the approved body to the exact hosted version/name, with no hand edits.
- [ ] Add a focused static test that pins source equality, function names, signatures and grants.

### Task 2: Resolve review notification source

**Files:** Create a uniquely versioned forward migration under `supabase/migrations/`; extend the focused test.

- [ ] Confirm historical feature intent, current UI consumer, notification type/RLS/dedupe index, and absence of equivalent hosted trigger/function.
- [ ] Write a failing focused test for a forward-only, idempotent notification package.
- [ ] Copy the reviewed historical function/trigger source into the forward migration only if classified as a present defect, then verify the test passes.

### Task 3: Classify and document the remaining discrepancies

**Files:** Create `docs/test-runs/2026-10-14-rc03-migration-reconciliation.md` and a 26-row machine-readable classification table.

- [ ] Token-compare formatting/comment candidates with strings and quoted bodies preserved.
- [ ] Trace all nine historical SQL differences to current functions, policies, data and later migrations.
- [ ] Check four duplicate versions and repeated name for dependency/order effects; retain mapping instead of changing applied IDs.
- [ ] Record one required classification per row and the current-state evidence.
- [ ] State GO/NO-GO for hosted reconciliation and isolated Commerce environment preparation.

### Task 4: Verify and checkpoint

**Files:** The above source and report artifacts only.

- [ ] Run focused static/SQL source test and applicable release validators.
- [ ] Run `git diff --check`, lint, typecheck and build when dependencies are available; report any skipped check as unrun.
- [ ] Review branch diff for secrets, unintended files and hosted actions.
- [ ] Commit only to the isolated RC-03 branch and stop before hosted deployment or Commerce E2E.
