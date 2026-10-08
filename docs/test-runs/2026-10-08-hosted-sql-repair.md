# Owner-approved hosted five-function SQL repair

Date: 2026-10-08. Project: `etkupijfdznljimrfyct` (current SecondPart Preview).

Status: **APPLIED / READBACK VERIFIED / HOSTED DISPOSABLE ACCEPTANCE BLOCKED**.
Subsequent safe acceptance closed the four repaired defects as **FIXED / VERIFIED**: zero known P0/P1 among RC26-06 and RC26-08. See [independent closure](2026-10-08-safe-acceptance-independent-review.md). This application report retains the original rollout evidence; it is not launch approval.

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

## Subsequent safe acceptance and smallest external gate

The owner rejected committed shared-host race fixtures and destructive cleanup. The replacement strategy completed **32/32 hosted rollback-only scenarios**, with all 448 fixture-count checks zero and restored profile, queue and SQL context state. **67/67 isolated PostgreSQL 17 tests** passed against a fresh export of the exact five deployed function definitions, including seven real overlap schedules. Independent review classifies the checkout P0, fitting P1 and two authorization P1 defects as FIXED / VERIFIED.

See [hosted results](2026-10-08-hosted-deletion-acceptance.md), [exact-body concurrency proof](2026-10-08-exact-deployed-pg17.md) and [independent classification](2026-10-08-safe-acceptance-independent-review.md). No committed shared-host concurrency package or global privacy worker was executed.

Normal-flow Auth/Storage deletion remains a separate external acceptance gate. The Preview maintenance credential is now branch-scoped and stored sensitively; a request-specific route is prepared, and an empty allowed-request map prevents accidental execution until a dedicated disposable request is configured. Three synthetic Auth Admin-created identities do not prove mailbox lifecycle.

Smallest owner action: open the current PR #17 Preview, register a fresh disposable email, click its confirmation email and reply DONE. Do not reuse the owner's account or send passwords/secrets. Subsequent normal-flow deletion evidence must verify request, scoped worker, Storage cleanup, hard Auth deletion, retained integrity, failed sign-in and idempotent retry; none is inferred from SQL-only acceptance.

Other external gates remain fresh recovery/session lifecycle, owner-known DVSA derivative, adverse Stripe Sandbox flows, physical Android/FCM/camera/gallery/test track, final signing/App Links/submitted AAB, legal/Data Safety and marketplace supply. PR #17 remains draft/open/unmerged; no main or Production change is authorized.
