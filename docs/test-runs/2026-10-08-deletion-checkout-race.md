# Claimed deletion and retained fitting authority — local P0/P1 repair proposal

Date: 2026-10-08. Worktree: `codex/final-rc-hardening`, based on `0c3860dfafabbd22811d7b633d3702543dcfa3b4`.

Status: **repair deployed and independently FIXED / VERIFIED through safe hosted rollback acceptance and exact deployed-body PostgreSQL 17 concurrency proof.** See [closure evidence](2026-10-08-safe-acceptance-independent-review.md). The proposal and pre-application narrative below are historical reproduction evidence; they do not require another shared-host concurrency run or migration approval. Normal mailbox/Auth/Storage deletion remains a separate acceptance gate.

## Root cause and impact

`processAccountDeletionRequest` obtains its final commerce blocker check through `prepare_claimed_account_deletion`, then awaits tracked-image cleanup, owner-prefix Storage cleanup and external Auth hard deletion. Deletion claim freezes seller inventory and suspends owned garages. The existing buyer checkout and fitting-request creation functions have no claimed-deletion guard or common serialization with deletion claim.

The actual worker plus actual checkout/blocker/preparation/completion SQL reproduced this ordering on an isolated reduced PostgreSQL schema:

1. A deletion request is claimed with no live commerce blocker.
2. Final deletion preparation succeeds.
3. During a Storage await, that buyer reserves another seller's part and attaches a synthetic Checkout Session.
4. Auth/profile deletion detaches the retained order's buyer FK.
5. The deletion audit reaches `completed`; the new provider-backed order remains `unpaid`, stock is `0`, and `buyer_id=null`.

Root release QA classifies that payable-checkout/identity loss as **P0**. No real charge was made to prove it.

The separate Buy + Fit reproduction uses the same actual worker/SQL with a valid catalogue vehicle and a different active garage. A fitting request created after final preparation survives completed deletion as `status=requested`, `buyer_id=null`. This is a **P1 operational/privacy boundary defect**; no fitting payment was demonstrated. Fitting obligations protect both the buyer and garage owner in the existing blocker, so locking only the requesting buyer would leave the target garage's deletion ordering unprotected.

Expected for each protected activity: if creation wins first, deletion must block on the committed obligation. If deletion wins first, activity creation must refuse without taking stock or creating an active fitting request.

## RC26-08 — P1 retained fitting participant authorization

The actual `garage_respond_fitting_request` checks `request_row.owner_id<>actor and not private.is_admin()`. For a retained garage with `owner_id=null`, SQL evaluates that expression to NULL for an unrelated non-admin; the IF does not raise. Actual SQL reproductions showed an unrelated authenticated actor could quote, decline or complete the retained fitting request. Root's read-only hosted FK check confirms `garage_partners.owner_id` uses ON DELETE SET NULL, and fitting buyer identity can also detach. There are no custom fitting-table triggers; the existing garage review/timestamp triggers remain unchanged.

The actual `send_fitting_request_message` has the related guard `actor not in (request_row.buyer_id,request_row.owner_id) and not private.is_admin()`. With either participant NULL, an unrelated non-admin produces NULL instead of true, so the accepted-only RPC inserts that user's message; with an existing buyer it also sends a fitting-message notification. Actual current SQL reproductions confirm the bypass for null buyer, null owner and both null. A valid stranger profile was seeded so sender FK failure could not mask the authorization defect.

The exact fourth replacement uses `request_row.owner_id is distinct from actor`, so a missing owner fails closed for unrelated callers while the explicit administrator override remains available. Valid garage owners retain quote/decline/complete authority. Authentication remains required, actual hosted grants remain unchanged, and no RLS or transition policy is altered. The fifth replacement uses `actor is distinct from request_row.buyer_id and actor is distinct from request_row.owner_id and not private.is_admin()`. Existing buyer/garage participants and administrators retain messaging authority, including a surviving participant when the other identity is detached. The accepted-only state rule, recipient logic and message validation remain unchanged.

## Exact repair

Atomically replace these five existing functions:

- `public.prepare_checkout_order(uuid,integer,text)`;
- `public.claim_account_deletion_request(uuid)`;
- `public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text)`;
- `public.garage_respond_fitting_request(uuid,text,integer,text)`;
- `public.send_fitting_request_message(uuid,text)`.

Checkout, claim and fitting creation use the same server-derived account advisory transaction lock before request/listing/inventory locks. The fourth and fifth functions change only nullable-participant authorization. Fitting resolves both buyer and target garage-owner identities, obtains those account locks in sorted UUID order, checks claimed deletion for either participant, and re-reads the same active garage owner after waiting. This prevents reciprocal fitting requests from inverting account locks and prevents stale garage availability from crossing a committed claim.

Creation refuses `processing` deletion or previously claimed `failed`/`blocked` retry (`attempt_count > 0`). Ordinary requested, unclaimed blocked/failed, cancelled or no-request accounts retain their normal behavior. Existing validation, calculations, reservation writes, seller/garage freezing, blocker logic and **actual hosted grants** are preserved. No RLS is weakened.

Client checks cannot protect a directly callable authenticated RPC or serialize the external Storage/Auth await window. A state check alone cannot close the activity-before-claim interleaving: creation could pass before a claim while the claim sees no committed obligation. The common lock closes both orderings under the application's READ COMMITTED isolation. Checkout/claim take one account lock; fitting takes participant locks in UUID order before subsequent work.

The actual response functions were traced and tested. `buyer_respond_fitting_quote` accepts only `quoted`; garage quote accepts only `requested`/`quoted`; those are already blocker states alongside `accepted`. Neither response function can reopen terminal `declined`, `cancelled` or `completed` requests. Terminal cancellation/decline/completion may safely clear an obligation; those state transitions remain unchanged. The buyer response function is unchanged; the garage response receives only the RC26-08 null-safe authorization check.

## Local verification

[Regression harness](../../scripts/test-account-deletion-checkout-race.mjs) explicitly loads the current checkout, claim, blocker, latest privacy preparation/completion and fitting creation/response/message definitions, avoiding accidental testing of a superseded function.

- Checkout RED: `node scripts/test-account-deletion-checkout-race.mjs --baseline` initially failed five unsafe cases: claim-first checkout, claimed processing/failed/blocked retries, and the post-final-preflight worker window. Ordinary requested/unclaimed blocked and checkout-first behavior passed.
- Fitting RED: `node scripts/test-account-deletion-checkout-race.mjs --fitting-baseline` failed eight unsafe cases with the checkout/claim proposal retained but original fitting creation restored: buyer claim-first, claimed processing/failed/blocked buyer and garage contexts, and the post-final-preflight fitting/worker window. Normal fitting, all three active blocker statuses and terminal response restrictions passed.
- RC26-08 RED: `node scripts/test-account-deletion-checkout-race.mjs --response-baseline` restores the actual original garage response after the other proposed boundaries. All three unrelated-null-owner quote/decline/complete denial assertions fail with missing expected rejection; owner/admin/anonymous contracts and reciprocal fixture identity checks pass.
- RC26-08 message RED: `node scripts/test-account-deletion-checkout-race.mjs --message-baseline` restores the actual original message function after the other four replacements. The three null-buyer/null-owner/both-null denial cases fail with missing expected rejection. Existing buyer/garage/admin authority, anonymous denial, accepted-only restrictions and reciprocal fixture checks pass.
- GREEN: `node scripts/test-account-deletion-checkout-race.mjs` passes **56/56** against the exact five-function proposal. Covers ordered creation/claim outcomes for both fitting participants; requested/quoted/accepted blocking; claimed retry refusal; checkout stock preservation; both worker/Auth failure windows; existing caller grants; unbound service rejection; anon/authenticated denial of destructive claim; ordinary account states, retained null-owner denial for quote/decline/complete, preserved owner/admin actions, retained-participant stranger message denial without message or notification insertion, surviving participant/admin message authority, accepted-only messaging, message ACL/unbound-service checks and explicit reciprocal-fixture buyer identity/FK validity.
- A bounded pre-repair commerce/deletion/security subset passes **196/196**: Stripe creation, cancellation and actual SQL ordering, refunds, payout retries, provider dispute ordering/terminal/recovery, deletion minimization, image/evidence cleanup authority, buyer order visibility and admin authorization boundaries.
- `node --check`, targeted ESLint and `git diff --check` pass for the local package. Full integrated web verification remains the root task's evidence boundary.

PGlite is a reduced PostgreSQL 18 schema; it does not prove real two-connection contention, hosted RLS, external Auth or Storage APIs. `--postgres` mode requires an **empty disposable localhost-only database named `secondpart_deletion_rc` on PostgreSQL 17**. It observes advisory waits for overlapping checkout/claim, fitting/buyer-claim and fitting/garage-claim in both orderings. A reciprocal fitting case deliberately holds the lower account first, proves the opposing call waits before taking the higher lock, and then lets the first fitting call finish; a buyer-first inversion would deadlock that schedule. The reciprocal fixture explicitly recreates the second buyer's Auth/profile after reset; a default SQL regression also exercises the same identities and both fitting inserts so the FK precondition is verified. The root task added an isolated PG17 CI job. All seven real-contention subcases passed in PostgreSQL 17 CI, alongside the 56 ordinary SQL cases (63/63), in [QA run 37775219015](https://github.com/keisaj9006/SecondPartShop/actions/runs/37775219015) at `d0173456cadd6b8aa54b4a1cdfffa813cdf95053`. This closes the isolated contention gate, not hosted application or external deletion E2E. No hosted execution was performed.

## Exact hosted preflight (read-only)

Root QA's 2026-10-08 readback reports project `secondpart` (`etkupijfdznljimrfyct`), ACTIVE_HEALTHY, PostgreSQL `17.6.1.166`, eu-west-2. Hosted migration ledger: 206 entries, maximum version `20261006093220`. All public base tables have RLS enabled. Existing deliberate public/authenticated SECURITY DEFINER warnings and disabled leaked-password protection remain separately documented.

[6 October ledger evidence](2026-10-06-dvsa-garage-release-readiness.md) records 208 local versus 206 hosted migrations, 162 matching names with different versions, four local-only and three hosted-only names. **No reconciliation is authorized.** Source filenames therefore cannot substitute for actual definition comparison.

Root saved actual function definitions/ACLs to temporary `secondpart-final-rc-hosted-functions.sql` and `secondpart-final-rc-hosted-fitting-functions.sql`, plus the message snapshot `secondpart-final-rc-hosted-fitting-message.json`. Machine comparisons normalizing only CRLF and outer whitespace found exact body equality with the corresponding source bases:

| Function | Hosted definition MD5 | Source base | Execute ACL |
| --- | --- | --- | --- |
| `private.account_deletion_blocker(uuid)` | `c52ca34390038932de34708400303fc6` | `20260909234500_account_deletion_buy_fit_guard.sql` | postgres |
| `public.claim_account_deletion_request(uuid)` | `f17d8c6a2a4238dcc15b248d31312717` | `20260909233000_account_deletion_retry_context.sql` | postgres, service_role |
| `public.prepare_checkout_order(uuid,integer,text)` | `0f8e5dd6273a7a17e79c2d9b91868f39` | `20260906163000_checkout_reservation_lifecycle.sql` | postgres, authenticated, service_role |
| `public.request_part_fitting_quote(uuid,uuid,uuid,smallint,text,integer,text,text)` | `ea5bfb6e644f9d11984f70fe8c8c519b` | `20260907181459_buy_fit_foundation.sql` | postgres, authenticated, service_role |
| `public.buyer_respond_fitting_quote(uuid,text)` | `685c990493161bf3f8ed9e271ef802ae` | `20260907181459_buy_fit_foundation.sql` | postgres, authenticated, service_role |
| `public.garage_respond_fitting_request(uuid,text,integer,text)` | `33c95c328b79c330926b2f9ec18a9a4c` | `20260907181459_buy_fit_foundation.sql` | postgres, authenticated, service_role |
| `public.send_fitting_request_message(uuid,text)` | `2ad95efce4ae15a84443d9f7ee8e599a` | `20260907183900_buy_fit_messages.sql` | postgres, authenticated, service_role |

Signatures, returns, defaults, PL/pgSQL, SECURITY DEFINER, empty search paths and blocker STABLE flag agree. PostgreSQL's printed casts/aliases/keyword case/dollar delimiters are formatting differences. No function-body/logic drift was found. The candidate preserves all actual ACLs of replaced functions; buyer response and blocker are unchanged; garage response and messaging have only the reviewed RC26-08 null-safe authorization changes. The five-function candidate is compatible with these captured definitions and privileges, without reconciling migration history.

Root's same-day read-only aggregate counters showed zero detached active-order buyers, zero retained fitting garages with NULL owner, and zero deletion requests currently processing. These point-in-time counts do not prove that no earlier affected record exists or that either authorization boundary is safe.

Before owner-approved application, refresh the definitions/ACLs and inspect the account-deletion/FK schema, later orders/fitting/claim triggers and live affected states. Stop on unexplained differences; revise and retest the exact proposal instead of applying unrelated pending migrations or repairing ledger versions.

## Rollout, rollback and recovery

No hosted SQL may run without the release owner's explicit approval. The approved operation must replace all five reviewed functions atomically, record an intentional new migration boundary, read back definitions/ACLs, and pass disposable QA tests. This proposal authorizes no live ledger edits, manually forced states, customer deletion, RLS changes or Production deployment.

Installation errors roll back the transaction without partial replacement; the existing defects then remain and deletion release sign-off stays blocked. If post-install verification fails, pause destructive deletion through an explicitly approved operational path and forward-fix the boundary. Restoring only one function or reverting to the vulnerable definitions can reopen these defects. Keep originals as evidence, not an automatically safe rollback.

Read-only reconciliation should identify active provider-backed orders or active fitting requests with detached buyers/garage owners and overlapping completed deletion windows. Resolve affected financial orders using actual provider evidence and normal authorized refund/reconciliation paths. Resolve affected fitting workflows through deliberate owner/support handling. Do not erase orders, force stock/payment states, recreate a guessed identity or attach a different member to manufacture recovery.

## Coverage limits and remaining gates

The local candidate addresses the two concretely reproduced checkout/fitting creation races, including both fitting participants, and the grouped RC26-08 retained-participant response/message authorization bypasses. It does not claim comprehensive deletion safety for every other possible obligation creator or every external Auth/Storage failure. Hosted definition refresh/schema/live-state compatibility, destructive disposable Auth + Storage deletion E2E, fresh Stripe adverse/dispute/replay evidence, legal retention sign-off, leaked-password configuration and physical-device/Android evidence remain separate gates.

No additional P0/P1 financial defect was confirmed in the bounded checkout/refund/payout/dispute/message/review/participant-authorization paths inspected. This is scoped engineering evidence, not a production launch-readiness claim.
