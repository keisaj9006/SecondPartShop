# Exact deployed deletion/fitting proof

Status: exact-body isolated PostgreSQL 17 proof PASS, 67/67 tests including seven observed advisory-lock schedules. Local quarantine/integrity/regression checks PASS. No shared-host concurrency or cleanup was executed for this proof.

## Quarantine

`scripts/build-hosted-deletion-concurrency.mjs` is retained as rejected-package evidence. Every mutating generator now requires an explicit PostgreSQL URL using localhost/127.0.0.1 and database `secondpart_deletion_rc`, with no URL query override or fragment. Generated SQL independently refuses any other database name or PostgreSQL major version. Shared Supabase uses database `postgres` and is rejected before fixture statements. This package is not used by the proof job.

The original committed-fixture design could expose active parts/garages, enqueue unrelated saved-search notifications, and delete records during cleanup. The isolation guard does not make that design safe for shared use. Previously generated SQL outside the repository remains unsafe evidence and must not be executed.

## Read-only provenance

The five definitions in [the export](2026-10-08-deployed-deletion-functions.json) were captured directly through `pg_get_functiondef` from project `etkupijfdznljimrfyct`, PostgreSQL 17.6. The export records capture time, signatures, owners, ACLs, function configuration and server-computed MD5 values. No credential or customer row is included.

| Function | SHA-256 of exact exported definition |
| --- | --- |
| claim_account_deletion_request | `298df11132d50d734c645bb1903189cf2ea931766158d0fcffadb9c3070ab1ee` |
| garage_respond_fitting_request | `ba89795496bb6db7c7c66f9a3626ee3a16d5298fa680da5df4bcddcb07dd087f` |
| prepare_checkout_order | `5b5cc18e4141097355ee169864632a0fb18969ac6a856d05c52a32d48c24a7c1` |
| request_part_fitting_quote | `8f18f70aade4dbcab3bd6e18ec27201c79f678bddec1c62f592918d9ab818e44` |
| send_fitting_request_message | `f78f603041f3817ae688a088c254bf2034bde13d2fbc2cdf0202bbb5cff7b056` |

## Isolated execution contract

The deletion job in `rebuild-nextjs-qa.yml` starts a fresh `postgres:17` service and invokes `test-account-deletion-checkout-race.mjs --postgres --deployed`. The harness refuses nonlocal URLs, a nonempty database, a different database name, a different PostgreSQL major version, or any baseline-substitution flags. Deployed mode never loads the five local baseline definitions or the local SQL proposal. It validates export hashes, loads each exported definition unchanged, restores its recorded ACL, and compares PostgreSQL's resulting definition, owner and ACL before and after the tests. The TAP log includes SHA-256/MD5/signature/ACL provenance. Explicit Bash pipefail prevents artifact capture from masking a failed test command.

The seven actual multi-session schedules cover checkout/claim in both orders, fitting/buyer-claim in both orders, fitting/garage-owner-claim in both orders, and reciprocal fitting lock ordering. Each waits for an observed advisory lock wait before releasing the first transaction; bounded statements detect deadlocks/hangs. Assertions cover attached order buyer identity, stock/order atomicity, claim-first refusal of new obligations and both participant blockers. Additional cases cover retry/deduplication, worker completion idempotency, terminal-state restrictions, NULL participant denial, owner/buyer/admin authority and execute grants.

## Boundaries

This is a reduced schema, not a hosted database clone. `auth.uid`, `private.is_admin` and `seller_checkout_ready` are explicit fixture helpers. Supporting blocker, final-preparation, completion and buyer-response functions come from the checked-in migration definitions. The actual application deletion worker uses test Auth/Storage adapters; it proves sequencing and identity/obligation invariants, not a real Auth API deletion or Storage operation. The five repaired functions alone are guaranteed to be the exact deployed definitions. Hosted rollback acceptance separately tests the real supporting authorization environment. No mailbox, external provider, customer notification, physical-device or full destructive hosted E2E PASS is implied.

## Local verification

- Quarantine RED: all three new safety checks failed against the former generator. GREEN: 3/3.
- Export-integrity RED: missing validator and silently ignored `--deployed` were caught. GREEN: 3/3.
- Combined local candidate/guard checks: 66/66 PASS (60 candidate SQL cases including suite parent, plus six guard/integrity cases).
- Focused ESLint: PASS.
- Independent review cleared the scoped export/loader/quarantine/workflow and separately reran all six guard/integrity checks successfully.

## Executed PostgreSQL 17 evidence

- Commit: `4e80738817cee87692483aaaec80b6f3854e8be4`, branch `codex/final-rc-hardening`.
- [Workflow run 37802359979](https://github.com/keisaj9006/SecondPartShop/actions/runs/37802359979); [deletion job 113397587340](https://github.com/keisaj9006/SecondPartShop/actions/runs/37802359979/job/113397587340) completed successfully at `2026-10-08T15:39:44Z`.
- Runtime: PostgreSQL `17.11 (Debian 17.11-1.pgdg13+2)`, matching hosted major version 17. Hosted export was from 17.6; this is not a claim of identical minor versions.
- Result: **67 passed, 0 failed, 0 skipped, 0 cancelled** (66 subtests plus suite parent). All seven actual overlap schedules passed, including the reciprocal lock-order schedule. Each schedule required an observed advisory lock wait; no deadlock occurred.
- The TAP log contains all five signatures, exact definition hashes and ACLs before testing, and `EXACT_HOSTED_FUNCTIONS_UNCHANGED_AFTER_TESTS` after byte-for-byte definition/owner/ACL verification.
- [Artifact 11560633368](https://github.com/keisaj9006/SecondPartShop/actions/runs/37802359979/artifacts/11560633368), `deletion-exact-hosted-pg17`, contains TAP results and the original exported definitions. GitHub artifact SHA-256: `a25c415244a31c7a1b75da1f1d94c4099fb9a0ed9dc8c416342e3263f66f21d4`.
- Downloaded export file SHA-256 independently matched the local read-only capture: `7163b1ba10aae8c3146f91bc9cd02d915bba4ac87a12c7a19abe8a7cbea080f2`.

This isolated result supports the repaired implementation's concurrency and authorization invariants. Final defect reclassification also considers the independently reviewed hosted rollback-only acceptance suite. Full Auth/Storage deletion E2E remains a separate acceptance gate.
