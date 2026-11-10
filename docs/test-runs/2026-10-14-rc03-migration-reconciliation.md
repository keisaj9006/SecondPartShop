# RC-03 — canonical Supabase source checkpoint

Date: 2026-10-14. [Issue #20](https://github.com/keisaj9006/SecondPartShop/issues/20). Isolated source branch `codex/rc03-migration-canonical`, based exactly on `b35864cc87714f7a16703be53985644758f7b410`. Hosted project inspected read-only: `etkupijfdznljimrfyct` (`secondpart` Preview). RC-01/RC-02 snapshots, the primary checkout, `main`, Production, accounts, orders and financial data were not changed.

## Decision

The **five-function repair source is recovered exactly** and now has a source file bearing the already-applied hosted version/name. The **review-ready notification is a present, scoped defect**: it was an intended feature, its notification UI and transaction-review eligibility path remain, and there is no hosted trigger/function or replacement notification path. A separate forward-only repair is prepared for review. **Neither file was applied to Supabase.** The repository therefore describes the intended next state, while the hosted database still lacks the review-ready notification. Historical ledger identities also remain divergent; automatic migration push is unsafe.

The [RC-02 full mapping](2026-10-14-rc02-migration-matrix.csv) (unchanged copy from the preserved RC-02 worktree; [issue #19](https://github.com/keisaj9006/SecondPartShop/issues/19)) covers 208 local files and 207 hosted ledger rows. The [RC-03 classification table](2026-10-14-rc03-26-classification.csv) resolves every one of RC-02's 26 `UNKNOWN` rows to one required classification: **22 `SEMANTIC_MATCH`, 4 `SUPERSEDED`, 0 remaining `UNKNOWN` in that set**. This classification describes present semantics, not proof that each historical SQL statement was applied under its local filename.

## Exact five-function recovery

The source is the unchanged Git blob `d017345:docs/test-runs/2026-10-08-deletion-checkout-guard.sql` (Git blob `35e202be8fd892a21ca0aedf527bd27b9eb20438`, file SHA-256 `9e7a6a6fa694b93999c2fb7b90ff5562dabb4917487e22227e568e69334df055`). The approved [8 October deployment record](2026-10-08-hosted-sql-repair.md) specifies hosted ledger version/name `20261008130523_account_deletion_checkout_fitting_serialization`. Removing only the source's outer `BEGIN;`/`COMMIT;` transport lines and normalizing CRLF to LF gives a **21,178-character exact match** to the current hosted `schema_migrations.statements[1]`. No function body, grant or comment was reconstructed or edited. The adopted migration file differs from the hosted statement only by one final empty line removed to satisfy `git diff --check`: `supabase/migrations/20261008130523_account_deletion_checkout_fitting_serialization.sql`, SHA-256 `b27f06d1d4d787827d2c476c25da22748d2b53d17e8097919e41ce718722b934`.

Fresh `pg_proc` readback confirms all five signatures and result types, `SECURITY DEFINER`, empty `search_path`, and the intended execute privileges: `claim_account_deletion_request(uuid)` is service-role only; `prepare_checkout_order`, `request_part_fitting_quote`, `garage_respond_fitting_request` and `send_fitting_request_message` are authenticated/service-role, never anon. The five definition hashes match the owner-approved deployed readback:

| Function | Current hosted `pg_get_functiondef` MD5 |
| --- | --- |
| `prepare_checkout_order` | `2a7aa5c2f3d1de0882235d4c96e9664e` |
| `claim_account_deletion_request` | `3e58f123a5a006f2fac0b17d3eee8e60` |
| `request_part_fitting_quote` | `f6d36fe6679a3dda7b9c8f63bb5b4ab1` |
| `garage_respond_fitting_request` | `aef7f027fe4c83e0b80c911ddc656dec` |
| `send_fitting_request_message` | `9e80d7ad723d78539624fed72561e305` |

This is **`MISSING_SOURCE` resolved in the repository**. It does not call for replaying the five-function migration on this host. The copied historical comment saying “NOT an applied migration” belongs to the exact original SQL text; the 8 October ledger/readback above establishes that it *was* applied after approval. We retain the exact bytes for auditability.

## `review_ready` verdict: DEFECT / MISSING_HOSTED

Commit `8bc238d` added `20260906225000_review_ready_notifications.sql` expressly to notify both transaction participants when verified reviews unlock. The historical source requires `fulfilment_status='completed'`, `payout_status='released'` and a non-null `funds_released_at`, inserts buyer/seller `account` notifications with unique per-item dedupe keys, and links to `/account/reviews`. On the current host, the notification type constraint allows `account`, the per-profile dedupe unique index exists, notifications have RLS and authenticated read policy, and the `/notifications` UI consumes records. `/account/reviews` still queries review opportunities; order pages link there once funds are released. The hosted catalogue has no `private.notify_transaction_review_ready`, no `transaction_review_ready_notification` trigger, and no public/private function with the review-ready message or dedupe key. Repository search found no application-side replacement producer.

Therefore this is **a missing proactive notification**, not a missing review-eligibility or review-submission mechanism and not an obsolete feature. `supabase/migrations/20261014202700_review_ready_notifications_forward.sql` repeats the reviewed historical function/trigger definition after an explanatory header. It is distinct from the five-function adoption and remains **pending hosted approval**. The static comparison pins its body to the historical file. An isolated PGlite SQL test applied it twice, verified no notification before eligibility, two participant notifications after release, and no duplicates on repeated transitions. This does not prove behaviour in the hosted provider flow.

## Nine historical SQL text differences and current effect

| Migration name | RC-03 class | Evidence and current effect |
| --- | --- | --- |
| `marketplace` | `SUPERSEDED` | Early `private.handle_new_user` qualification differs; later applied `fix_profile_trigger` and `ugc_terms_and_user_blocking` replace it. Current function exists. |
| `hierarchical_categories_and_vehicle_aliases` | `SEMANTIC_MATCH` | Hosted statement seeded four categories while local source has 191. Read-only comparison of all 191 live rows found exact matches for IDs, names, slugs, transmission/selectable flags, sort order, search terms and 175 parent relations; all three source category indexes exist. Later least-privilege migration intentionally removed authenticated alias-table write grants. Historical provenance remains different. |
| `vehicle_alias_policy_cleanup` | `SEMANTIC_MATCH` | Source has extra RLS enable/drop statements; live alias table has RLS and the four intended read/admin policies. Earlier write grant was later revoked by `least_privilege_table_grants`. |
| `marketplace_category_ancestor_search` | `SEMANTIC_MATCH` | Source introduces `category_descendant_ids`, hosted statement introduces `marketplace_search_part_ids`; hosted preceding migration already includes the descendant helper and both functions are live. Search function later replaced. |
| `marketplace_search_ranking` | `SUPERSEDED` | Hosted explicit `SECURITY INVOKER` and source function text differ; applied `buyer_search_ranking_v2`, `marketplace_search_precision`, and `indexed_marketplace_search` replace the search function. |
| earlier `invalidate_verification_on_seller_identity_change` | `SUPERSEDED` | Earlier local body differs from the hosted same-name statement; the later local file exactly matches that hosted statement. Subsequent seller-business-kind, insert protection and geo protection replace the guard again. |
| `reverse_released_payout_on_lost_provider_dispute` | `SEMANTIC_MATCH` | Only unmatched token sequence is the legacy three-argument close-overload DROP. Host applied that exact DROP in dedicated version `20260907151740`; the obsolete overload is absent, four-argument service-only overload exists. |
| `require_positive_stock_for_active_listings` | `SEMANTIC_MATCH` | Hosted SQL adds output aliases to the `seller_import_batch_readiness` SELECT; `RETURNS TABLE` names and aggregate expressions agree. Live `parts_active_requires_stock` check enforces active stock > 0. |
| `marketplace_sorted_cursor_pagination` | `SUPERSEDED` | Local delivery-days integer cast differs from hosted first version. Applied `fix_marketplace_sorted_cursor_types` later replaced it; current hosted delivery and warranty sort casts are both present. |

The other 17 RC-02 `UNKNOWN` rows differ only in formatting/comments. A SQL lexer compared ordered tokens, recursively including dollar-quoted function bodies while preserving ordinary string and dynamic-SQL literals; all 17 token streams matched exactly. Their per-file classifications are in the CSV. This method proves source/host statement semantics for that subset, not complete equivalence of every live row or provider action.

## Duplicate identities and replay order

| Duplicate local version | Hosted unique versions and order | Dependency/order result |
| --- | --- | --- |
| `20260906282000` | `targeted_part_request_routing` `20260906193621` → `ranked_find_my_part_leads` `20260906193702` | Both define `seller_ranked_part_request_leads`; local lexical order would reverse the two. Later applied `part_request_match_lifecycle` replaces the function; current live definition uses `seller_part_request_matches`. **Fresh replay order is unsafe without a canonical mapping.** |
| `20260906282500` | `targeted_request_notifications` `20260906193940` → `buyer_request_match_counts` `20260906194004` | Notification trigger requires the earlier routed-match table; buyer-count function is a separate object. Local lexical order reverses their hosted order but table prerequisite still precedes both. |
| `20260907123500` | `vehicle_lookup_operational_guard` `20260907113255` → `saved_search_match_queue` `20260907121319` | Independent tables/functions; source collision remains unsafe for migration tooling. |
| `20260907125000` | `catalogue_sorted_marketplace_page` `20260907114421` → `saved_search_feed_index` `20260907121519` | Separate marketplace RPC and saved-search index; source collision remains unsafe for migration tooling. |

All eight source bodies match their respective hosted statements after newline/edge-space normalization (RC-02 proof). The repeated local name `invalidate_verification_on_seller_identity_change` at `20260906223000` and `20260907175000` is also retained: only the later file matches hosted `20260907171343`, and later guard migrations supersede its effect. **No applied timestamp or historical file was renamed or deleted.** The safe audit trail is the RC-02 full matrix plus RC-03 classification and exact adopted hosted source. A future migration-tooling repair must explicitly preserve original IDs and document an environment-specific baseline; no `migration repair` or automatic `db push` is authorized by this patch.

## Repository-only patch and verification

Changed source: exact adopted five-function migration, forward-only review notification migration, two focused tests, unchanged copy of the RC-02 full matrix, 26-row RC-03 classification CSV, this report and the implementation plan. No application runtime code changed. The five-function artifact is already hosted; the review notification is **not** hosted. The repository and hosted database consequently **do not yet describe one fully identical intended state**.

Focused checks: `node --test scripts/test-rc03-migration-source.mjs` **5/5 PASS**; `node --test scripts/test-rc03-review-ready-sql.mjs` **1/1 PASS** in isolated PGlite, including second application and dedupe; existing `node --test scripts/test-account-deletion-checkout-race.mjs` **60/60 PASS**. These are isolated/local checks, not hosted Commerce E2E.

## Gates and RC-04

- **Hosted source reconciliation: NO-GO for automated application.** The exact five-function source is restored, but the review notification still needs separate rollout approval and the old version/name collisions need a reviewed migration-tooling/baseline strategy. No hosted write was attempted.
- **Isolated Commerce B–H environment preparation: GO.** Prepare a disposable database/project, seeded synthetic accounts, provider TEST credentials and controlled webhook endpoints; do not start provider E2E or touch shared financial fixtures in RC-03. Bootstrapping from the current migration directory must pause on duplicate identities until the baseline/order strategy is reviewed.
- **RC-04 order:** (1) review the RC-03 diff, classifications and exact source proofs; (2) decide and test a canonical migration replay/baseline strategy for a disposable environment, preserving historical IDs; (3) rehearse the pending review-ready migration and readback in isolation; (4) obtain explicit approval before any hosted migration or ledger action; (5) only after the migration boundary and TEST prerequisites are proven, prepare Commerce B–H scenario execution. Production and `main` remain separate gates.

## Final verification record

- All 14 repository `validate:*` release validators from the AGENTS.md baseline ran and exited 0 (notifications, mobile performance, launch baseline, monitoring, commerce E2E harness, checkout expiry race, payout recovery, Android RC, public contact, account deletion E2E harness, production origin, production env, beta feedback, seller read policy). These are static/harness validations, not provider transactions.
- `npm run lint` exited 0 with 0 errors and four pre-existing warnings in the legacy mobile shell/test files. `npm run typecheck` exited 0. `npm run build` exited 0 after installing a local copy of the exact-SHA worktree dependencies into this isolated checkout.
- The first sandboxed build failed because Windows denied path canonicalization; a second build with a dependency junction failed because Turbopack disallows `node_modules` outside the project root. Offline `npm ci` could not fetch uncached `zod-validation-error-4.0.2`. Copying the already available dependencies into the worktree resolved the environmental issue; the subsequent full build passed. None of these failures was reported as a code PASS.
- Final `git diff --check`, branch status, commit and primary-checkout preservation are verified at checkpoint close.
