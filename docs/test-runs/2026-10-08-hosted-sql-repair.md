# Owner-approved hosted five-function SQL repair

Date: 2026-10-08. Project: `etkupijfdznljimrfyct` (current SecondPart Preview).

Status: **APPLIED / READBACK VERIFIED / HOSTED DISPOSABLE ACCEPTANCE BLOCKED**.
Release severity remains **1 P0 and 3 P1 OPEN**, pending the owner's specified hosted disposable race and authorization evidence. No claim of zero P0/P1 or launch readiness.

## Exact application

Owner approval explicitly limited application to [the reviewed SQL](2026-10-08-deletion-checkout-guard.sql). Supabase `apply_migration` returned success for:

- Version: `20261008130523`
- Name: `account_deletion_checkout_fitting_serialization`
- Source branch code/evidence boundary: `7cc3568e3d70f5d5f9a108e46564f671193d1498`
- The runner's transaction was used; only the outer BEGIN/COMMIT transport wrapper was omitted.

No pending migration push, historical ledger reconciliation, table/RLS/retention change, Production configuration change, main change or PR merge occurred. The original reviewed SQL is retained unchanged.

## Refreshed preflight

All seven captured functions (five replacements plus unchanged blocker/buyer response controls) matched the previously reviewed definition hashes. Signatures, defaults, returns, SECURITY DEFINER, empty search paths and ACLs matched. The related profile/Auth cascade, commerce/fitting SET NULL and fitting RESTRICT foreign keys and observed custom triggers matched the reviewed assumptions. Referenced live columns/types/defaults were inspected; no repair-affecting unexplained drift was found.

Ledger before application: **206**, ending at `20261006093220_garage_vehicle_identity`. Historical drift was preserved.

Live deletion states: two completed requests, zero processing. Detached active order buyers, fitting buyers and garage owners: zero each. These are point-in-time counts.

## Immediate post-apply readback

Every replacement's body was compared automatically to the approved SQL after normalizing line endings and PostgreSQL's function delimiter. Bodies matched exactly. Signatures/defaults/returns, SECURITY DEFINER, search paths and ACLs matched their preflight values.

| Function | Hosted pg_get_functiondef MD5 |
| --- | --- |
| prepare_checkout_order | `2a7aa5c2f3d1de0882235d4c96e9664e` |
| claim_account_deletion_request | `3e58f123a5a006f2fac0b17d3eee8e60` |
| request_part_fitting_quote | `f6d36fe6679a3dda7b9c8f63bb5b4ab1` |
| garage_respond_fitting_request | `aef7f027fe4c83e0b80c911ddc656dec` |
| send_fitting_request_message | `9e80d7ad723d78539624fed72561e305` |

Claim retains postgres/service_role execute; the other four retain postgres/authenticated/service_role execute. Unchanged blocker and buyer response hashes match.

Public/private function, relation/RLS/ACL, constraint and noninternal-trigger catalogue snapshots showed exactly five changed function identities. Referenced schema was inspected before application. No unrelated object change was observed.

Ledger after application: **207**, with the single new version above. Exact safety counters remained zero; deletion states remained two completed requests. All public base tables still have RLS enabled.

Security advisors remain at the previously reviewed 11 INFO no-policy internal tables, 16 anonymous and 68 authenticated SECURITY DEFINER notices, plus disabled leaked-password protection. Existing deliberate access remains subject to semantic review; [password protection configuration](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains an owner/provider gate.

## Fresh verification and limits

- Local exact SQL regression: **56/56**, zero failed/skipped.
- Fresh isolated PostgreSQL 17 regression: **63/63**, including seven real contention schedules, zero failed.
- [Fresh CI run 37781839135](https://github.com/keisaj9006/SecondPartShop/actions/runs/37781839135): all seven jobs successful on the unchanged source boundary.
- Hosted rollback-only probes: four unbound activity calls refused with Authentication required; destructive claim execute denied to anon/authenticated. No fixture or provider mutation occurred.

The PG17 tests are isolated CI tests. **They are not hosted disposable race evidence.** The hosted probes do not prove participant/admin authorization with actual retained fixtures, both race orderings, reciprocal hosted locking, or external Auth/Storage deletion.

[Machine-readable readback](2026-10-08-hosted-sql-repair.json) records exact signatures, ACLs, hashes and scope.

## Smallest external gate

Required hosted disposable checkout/fitting race and participant authorization QA: **NOT RUN / BLOCKED** on fresh disposable authenticated test sessions and controlled fixtures. Destructive normal deletion E2E: **NOT RUN / BLOCKED** on the same dedicated confirmed QA identity plus configured Preview maintenance authorization.

The [deletion runbook](../account-deletion-e2e-runbook.md) requires “Create a new account through the normal SecondPart sign-up flow using a dedicated QA mailbox/address” and “Use the normal authenticated maintenance endpoint”. This worktree has no configured disposable session or maintenance credential. The previous Preview inventory showed CRON_SECRET scoped to rebuild-nextjs, without confirmed applicability to PR #17. No secret was decrypted or copied to manufacture that prerequisite.

The owner has already authorized the repair and fresh disposable deletion test. **No repeat approval is needed.** Supply a dedicated disposable QA mailbox/session through the normal flow and configure scoped maintenance authorization securely; do not paste secrets into the report or use the owner's real account. Use the established environment configuration and normal product flows. Do not bypass confirmation, manually force deletion states or manually hard-delete Auth to obtain a pass.

Then execute every owner-required hosted checkout/deletion and fitting/deletion ordering (including waits, retries and reciprocal scheduling), retained-participant authorization, followed by request → normal worker → Storage cleanup → identity deletion/detachment → completed audit → second-pass idempotency. Verify failed sign-in, absent Auth identity and retained integrity.

RC26-06, related fitting/deletion P1 and both RC26-08 P1s remain OPEN until hosted disposable acceptance passes. Auth + Storage destructive E2E also remains unchecked. Other unchanged owner gates are fresh email/recovery lifecycle, owner-known DVSA derivative and UX check, Stripe Sandbox adverse/return flows, physical Android/FCM/camera/gallery/test track, signing/App Links/AAB, legal/Data Safety and marketplace supply.

PR #17 remains draft/open/unmerged. The follow-up commit changes release evidence only; the final branch HEAD is recorded in the PR body and task handoff.
