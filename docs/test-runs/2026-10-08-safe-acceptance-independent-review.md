# Independent deletion acceptance review — 2026-10-08

Scope: RC26-06 checkout/deletion and fitting/deletion races; RC26-08 ownerless fitting response and detached-participant message authorization. This review does not certify whole-product launch readiness.

## Classification

| Defect | Previous severity | Current classification |
| --- | --- | --- |
| RC26-06 checkout after deletion authority | P0 | FIXED / VERIFIED |
| RC26-06 related fitting creation against buyer/garage deletion | P1 | FIXED / VERIFIED |
| RC26-08 unrelated response to ownerless retained request | P1 | FIXED / VERIFIED |
| RC26-08 unrelated message to detached-participant request | P1 | FIXED / VERIFIED |

No known P0/P1 remains within these four reviewed defects. The rejected destructive shared-host concurrency package is not an outstanding implementation defect.

## Evidence independently inspected

- Exact exported definitions, signatures, hashes, owner, SECURITY DEFINER/search-path settings and ACL validation; unchanged loading and before/after PostgreSQL definition checks for all five repaired functions.
- Downloaded CI TAP from run 37802359979: 67 passed, zero failed/skipped; all seven true overlapping schedules passed with mandatory observed advisory waits, including reciprocal participant lock order. PostgreSQL 17.11 matches hosted major version 17. Downloaded export SHA256 matches repository capture: `7163B1BA10AAE8C3146F91BC9CD02D915BBA4AC87A12C7A19ABE8A7CBEA080F2`.
- All 32 exact hosted SQL artifacts were cleared before execution against manifest SHA256 `136DA66EB77271891E9B6F0872B895ADA0AC6F4743DE1DFA1E1040E38543ECDB`. Each has one bounded behavior, fresh child UUIDs, explicit role/claims outside expected-error subtransactions, BEGIN/ROLLBACK and post-rollback checks. No COMMIT, cleanup DELETE, TRUNCATE, global worker or irreversible provider operation.
- Reachable SECURITY DEFINER/trigger paths reviewed against the safety inventory and fresh trigger snapshot. Queue/outbox writes are transactional; admin profile changes are scoped to the tagged synthetic identity and rolled back. No external irreversible callback was found within that inspected graph.
- `2026-10-08-hosted-rollback-results.json` checked programmatically against the exact reviewed manifest and every SQL file hash: all 32 names/order/behaviors and fixture UUIDs match; all 448 fixture counts are numeric zero; every profile role array is buyer x3; all profile-state, refresh-queue and clean-context hashes match baseline. Recorded evidence supports 32/32 hosted PASS.
- One mistyped project reference was recorded as a rejected transport request, not a successful SQL test; the approved target produced the successful scenario result.
- Reviewer independently reran six quarantine/export tests, four HTTP-quarantine tests and 35 hosted-harness local tests: all passed. No hosted mutations were executed by this reviewer.

## Boundary and residual gates

The true concurrency database uses a reduced fixture schema; supporting authorization/readiness helpers and ancillary migration functions are not a clone of the whole hosted environment. The five repaired bodies alone are guaranteed exact. Hosted rollback cases independently exercise real deployed authorization and trigger behavior using explicit synthetic SQL context. These are not signed browser-JWT, normal signup/mailbox, Auth API deletion, Storage cleanup, payment-provider or device tests.

Normal destructive account-deletion E2E requiring a disposable confirmed mailbox/session and real Auth/Storage deletion remains a separate owner/external acceptance gate. Provider/payment, physical Android/device, legal/policy and marketplace readiness also remain separate. Do not label those gates PASS from this review, and do not reopen these four code defects merely because the unsafe shared-host concurrency package was deliberately rejected.

Repository evidence: the exact reviewed manifest is preserved at docs/test-runs/2026-10-08-hosted-rollback-manifest.json; hosted outcomes are at docs/test-runs/2026-10-08-hosted-rollback-results.json. The manifest hash above identifies the reviewed bytes.
