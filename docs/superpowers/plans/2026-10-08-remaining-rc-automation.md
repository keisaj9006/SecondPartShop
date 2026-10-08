# Remaining RC automation plan — 8 October 2026

Goal: exhaust safely automatable gates before one compact owner/device pass.
Spec: owner continuation attachment 8c034670-2363-4e3b-b706-a4d107014604.
Workflow: Superpowers, independent parallel review, systematic debugging and TDD for reproduced defects.

## Constraints
No main/Production/Stripe Live, merge, Play submission, destructive shared-host cleanup, global worker, owner/customer data mutation or secret output. Quarantined harnesses remain blocked. Closed P0/P1 require new reproductions to reopen.

## Review focus
Full save/read/navigation boundaries; stale auth fail-closed; provider-only evidence distinguished from application E2E; artifact package/SDK verification without signing secrets; stacked ancestry preserved.

## Tasks
- [x] Root: Auth browser and lifecycle harnesses; Buyer/Seller/Garage coverage and repairs. Deployed anonymous/malformed/stale-session boundaries pass; retained authenticated GET credentials remain approval-gated.
- [x] Commerce: safe Sandbox provider scenarios and complete scenario evidence map.
- [x] Android: ephemeral production-style AAB/artifact inspection and Play code/owner/business matrix.
- [x] Independent reviewer: security/RLS and isolated scale/navigation evidence.
- [x] Root: exact PR17 -> auth, PR16 -> DVSA, PR10 -> rebuild sequence/checks without merging.
- [x] Root: review results, targeted/full validation, exact-HEAD Preview/CI, evidence/PR17 and compact owner pack.

Owner explicitly requested autonomous continuation; no additional plan approval is needed for specified automation or scoped defect repair.
