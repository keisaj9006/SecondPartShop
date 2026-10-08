# Final RC hardening execution plan — 2026-10-08

> Required workflow: Superpowers subagent-driven development, systematic debugging, TDD and independent review.

Goal: exhaust safely automatable P0/P1 repairs before owner acceptance, without feature expansion.
Architecture: current hosted Next.js app and supported Android wrapper; isolated stacked branch. Preserve server/provider authority and fail-closed fitment and roles.
Spec: owner's FINAL RELEASE CANDIDATE HARDENING request supplied 8 October 2026; AGENTS.md and canonical release runbooks.

## Global constraints
- Branch codex/final-rc-hardening starts from verified PR #16 HEAD 0c3860dfafabbd22811d7b633d3702543dcfa3b4. PRs #16 and #10 stay open/unmerged.
- Never modify main, deploy Production, use Stripe Live, weaken RLS, fabricate provider/fitment results or touch owner data.
- No hosted DDL without exact migration/preflight/impact/recovery approval; historical ledger drift remains unresolved.
- Root owns integration/shared files; specialists discover independently, edits require explicit file ownership.
- Fresh real mailbox, physical Android and real provider evidence remain distinct from mocks/static tests.

## Ordered work
- [x] Verify original checkout, remote PR state, exact safe base; isolate existing unrelated dirty work.
- [x] Record Preview/backend/payment environment, migration/security inventory and fresh baseline tests.
- [x] QA commerce/security/deletion authorization; reproduce and fix confirmed scoped P0/P1 defects.
- [x] QA marketplace/Garage/buyer/seller/CSV/images, scale and cross-flow state; reproduce and fix scoped defects.
- [x] QA Auth/account, Android/App Links and release contracts; reproduce and fix scoped defects.
- [x] Exercise actual Preview UI and HTTP negative boundaries; distinguish unavailable authenticated fixtures.
- [x] Run complete suite, lint, typecheck, build, production audit, all applicable static validators and isolated scale/concurrency proof.
- [x] Fresh independent final review; repair actionable P0/P1; rerun affected verification.
- [x] Commit logical batches, exact-head Preview, canonical docs/test-runs evidence and concise owner checklist.

## Review focus
Provider errors must not imply success; stale sessions must not imply signed-out identity; invalid vehicle parameters must not invent fit; duplicate/reordered mutations must preserve server authority; external Android returns must reach the correct hosted page.

## Coordination/preflight
| Tasks | Shared boundary | Ruling |
| --- | --- | --- |
| Commerce + marketplace | checkout fitment | Discovery read-only; root allocates any overlapping edits. |
| Auth + marketplace | viewer-scoped vehicle state | No shared-file edits without root coordination. |
| Android + auth | callback/return URLs | Inspect current hosted-wrapper contract together. |
| All + release | docs/validation/build | Root owns ledger, integrated build, commits and deployment. |

Ruling: owner explicitly requested autonomous execution of this specified hardening loop. No additional plan approval is needed for reproduced defect repairs within these constraints.
## Handoff boundary

All safely authorized code tasks, local SQL proposal, independent review, full validation, code Preview and evidence packaging are executed. Hosted application/readback is complete under the subsequent explicit owner approval; the four SQL defects are subsequently FIXED / VERIFIED by safe hosted rollback and exact deployed-body PG17 evidence. PR #17 is draft/unmerged; PR #16/#10 remain unmerged. The original dirty checkout is preserved. Code verification is not launch approval.


## Owner-approved hosted repair follow-up — 8 October

The exact five-function repair is applied as `20261008130523_account_deletion_checkout_fitting_serialization`. Fresh preflight matched; body/ACL readback passed; only the five intended function objects changed. Historical ledger drift was preserved. Local 56/56 and fresh PG17 63/63 regressions pass. The later owner-approved safe strategy completed hosted rollback authorization and exact deployed-body PG17 concurrency acceptance; normal mailbox/Auth/Storage deletion remains separate. No known P0/P1 remains in these four repaired SQL defects. See [evidence](../../test-runs/2026-10-08-hosted-sql-repair.md).

## Owner-approved safer acceptance strategy — 8 October

The owner rejected the committed shared-host concurrency/cleanup package and global privacy-worker execution against unrelated work. Retain the rejected harness as evidence and quarantine it behind an explicit isolated-environment guard.

- [x] Rebuild shared-host acceptance as independent BEGIN / fresh UUID fixtures / one behavior / ROLLBACK scenarios, with no cleanup DELETE or COMMIT and no reused fixture rows.
- [x] Independently review each generated scenario and its hosted trigger, SECURITY DEFINER, queue and provider dependencies before execution.
- [x] Execute only reviewed rollback-contained hosted scenarios and separately prove every fixture UUID absent afterward.
- [x] Freshly export all five deployed function definitions, signatures, ACLs and hashes; load exactly those definitions into isolated PostgreSQL 17.
- [x] Run real overlapping checkout/fitting/deletion schedules, authorization, stock/identity and retry assertions against the exact deployed bodies.
- [x] Independently reassess RC26-06/08: distinguish known-open defects, fixed/verified repairs and environment acceptance limitations. Do not retain defect severity solely because unsafe shared-host concurrency was rejected.
- [x] Continue non-destructive product, security, Android/Play and provider-readiness QA; prepare normal-flow Auth/Storage deletion separately.
- [ ] Update current HEAD, PR #17, evidence and the smallest remaining owner action after verification.

This strategy supersedes earlier instructions requiring committed shared-host race fixtures. Existing three synthetic Auth identities are not evidence of external-mailbox confirmation. No destructive shared-host cleanup, global worker, main change, Production deployment or Stripe Live operation is authorized.
