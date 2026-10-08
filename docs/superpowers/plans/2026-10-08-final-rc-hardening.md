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

All safely authorized code tasks, local SQL proposal, independent review, full validation, code Preview and evidence packaging are executed. Hosted application/readback is complete under the subsequent explicit owner approval; one P0 and three P1 remain OPEN pending hosted disposable QA. PR #17 is draft/unmerged; PR #16/#10 remain unmerged. The original dirty checkout is preserved. Code verification is not launch approval.


## Owner-approved hosted repair follow-up — 8 October

The exact five-function repair is applied as `20261008130523_account_deletion_checkout_fitting_serialization`. Fresh preflight matched; body/ACL readback passed; only the five intended function objects changed. Historical ledger drift was preserved. Local 56/56 and fresh PG17 63/63 regressions pass. Required hosted disposable race/authorization QA and normal destructive deletion E2E remain blocked on disposable confirmed sessions/fixtures and maintenance authorization; one P0 and three P1 remain OPEN. See [evidence](../../test-runs/2026-10-08-hosted-sql-repair.md).
