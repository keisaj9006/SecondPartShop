# Hosted rollback-only SQL acceptance review and execution notes

Final execution evidence updated 2026-10-08; 32/32 reviewed hosted cases PASS at 15:53:05 UTC. Prepared for Preview project `etkupijfdznljimrfyct`. This is synthetic SQL role-context evidence, distinct from mailbox, browser authentication, provider payments, normal account-deletion lifecycle, and hosted concurrency evidence.

## Approved artifact boundary

The owner rejected committed shared-host concurrency fixtures. The replacement consists of 32 independent artifacts, each with fresh fixture UUIDs, exactly one tested RPC invocation, explicit role/actor assertions, one `BEGIN`, and one `ROLLBACK`. There is no `DELETE`, `COMMIT`, `TRUNCATE`, `DROP`, Auth mutation, Storage mutation, function replacement, RLS change, global worker, or cleanup flow. Do not execute the superseded checkout/reset/concurrency scripts.

Stable artifact directory: `C:\Users\joann\AppData\Local\Temp\secondpart-rollback-only-20261008-v2`.

- Manifest: `manifest.json`, SHA256 `136DA66EB77271891E9B6F0872B895ADA0AC6F4743DE1DFA1E1040E38543ECDB`.
- Builder: `scripts/build-hosted-deletion-acceptance.mjs`, SHA256 `E8527975F1D6BD9FAC0330989DF7D8FAD7D397DE4FEB07CE89C24AABB78D5461`.
- Local test: `scripts/test-hosted-deletion-acceptance.mjs`, SHA256 `6CF9E13020BF25C97F3AA1B14BE8A6F674DFE9A05151691AAFEE0C62A3522884`.

Independent reviewer `/root/safe_acceptance_review` checked all 32 files against the manifest, 160 unique fixture UUIDs, transaction boundaries, one behavior per case, and absence of destructive cleanup. It independently reran the final local harness: 35/35 PASS. Root coordinates hosted execution after this clearance; this specialist does not duplicate it. Do not regenerate the reviewed directory during execution: UUIDs and exact reviewed artifacts would change.

## Exact deployed function basis

`docs/test-runs/2026-10-08-deployed-deletion-functions.json` was observed at `2026-10-08 15:28:54 UTC`. The local harness imports these exact deployed definitions and captured grants, rather than a migration approximation.

| Function | Definition MD5 | Execute ACL |
| --- | --- | --- |
| claim_account_deletion_request | 3e58f123a5a006f2fac0b17d3eee8e60 | postgres, service_role |
| prepare_checkout_order | 2a7aa5c2f3d1de0882235d4c96e9664e | postgres, authenticated, service_role |
| request_part_fitting_quote | f6d36fe6679a3dda7b9c8f63bb5b4ab1 | postgres, authenticated, service_role |
| garage_respond_fitting_request | aef7f027fe4c83e0b80c911ddc656dec | postgres, authenticated, service_role |
| send_fitting_request_message | 9e80d7ad723d78539624fed72561e305 | postgres, authenticated, service_role |

The authorization tests intentionally exercise `SECURITY DEFINER` bodies through SQL `SET LOCAL ROLE` and transaction-local JWT claims, while verifying `auth.uid()` and `private.is_admin()`. They do not fabricate real signed HTTP JWTs or email lifecycle evidence. The authenticated claim case proves permission denial; it never successfully invokes the deletion worker claim.

## Fixture scope and indirect writes

The three Auth Admin-created identities must retain both metadata tags `qa_run_id=rc26-hosted-20261008-autonomous` and `qa_evidence_class=synthetic-not-mailbox`. All begin with buyer profiles. The preflight rejects identities with existing commerce/deletion/garage/push-device/notification parents. The SQL does not insert, update, or delete Auth users.

Fresh transaction-only fixture writes are limited to sellers, seller_payment_accounts for ordinary checkout only, parts, garage_partners, account_deletion_requests, fitting_requests, and a temporary role update on the synthetic stranger profile in the two admin cases. Part and garage fixtures are draft/pending for retained-participant authorization; active part/garage and seller checkout readiness exist only inside the transaction for normal creator behaviors. No provider account or real provider operation is used.

Actual behavior writes can reach orders, order_items, order_events, part stock/status, fitting_requests, fitting_request_messages, notifications, and mobile_push_outbox. Part triggers may reach `private.part_request_refresh_queue` and `private.saved_search_match_queue`. A safe selectable category is required with no open part request matching its recursive ancestors; there are no OEM/source-request/catalogue signal rows on the fixture listing. Queue state is compared inside fixture setup, and post-rollback queue hash is checked against the pre-execution baseline.

The inspected trigger/function bodies are recorded in `docs/test-runs/2026-10-08-pending-sql-safety-inventory.md`. Relevant checks include listing activation, seller verification and checkout readiness, reservation duplication/checkout limits, part-request refresh, saved-search enqueue, request notification/match handling, role protection/profile timestamp touch, and notification push enqueue. Root's fresh review found no custom triggers on fitting_requests, fitting_request_messages, mobile_push_outbox, private.part_request_refresh_queue, or private.saved_search_match_queue. Notifications only enqueue push rows through an enabled-device SELECT; fixture device preflight requires zero devices. Profile role changes invoke protect_profile_role and touch_updated_at; ensure_profile_handle is attached only to INSERT or UPDATE of handle/display_name and is not invoked by the admin role-only UPDATE.

No external-call primitive was found in the inspected bodies. This is a bounded inspected dependency statement, not a claim covering every extension, provider, schema object, or future deployment. There are no fixture cleanup DELETEs, so the historical deletion cascade inventory is not exercised by these artifacts. Ordinary-fitting message absence is supported by the reviewed creator and trigger path; its post-rollback fitting absence check includes the fresh part UUID, while message absence checks reference the predetermined retained-request UUID. Any unexpected dependency observed during execution is a STOP, not permission to broaden cleanup.

## Execution protocol and mandatory result checks

1. Confirm exact manifest/file hashes, target project, and independent clearance. Execute each entire reviewed `.sql` file as one connector request, sequentially. Never interleave product mutations against the three tagged identities.
2. Capture the manifest descriptor `contextQuery` baseline before execution. Preserve profile_state_hash and refresh_queue_hash baselines across cases. A separate pooled request cannot prove session restoration; the artifact itself asserts clean postgres/empty claims before BEGIN setup and again after ROLLBACK within the same submitted SQL request.
3. Accept PASS only when there is no SQL/transport/cancellation error, the expected denial or success assertion completed, the post-rollback clean-context assertion completed, and the final `result` JSON exists exactly once for the expected scenario.
4. Inspect **every** `fixture_counts` entry: sellers, seller_payment_accounts, parts, garage_partners, account_deletion_requests, fitting_requests, fitting_request_messages, order_items, orders, order_events, notifications, mobile_push_outbox, saved_search_queue, and part_image_cleanup must all be numeric zero. Do not infer success from an empty response or partial notices.
5. Require profile_roles to contain exactly three `buyer` values. Require profile_state_hash equal its baseline; this covers profile ID, role, and updated_at, including both admin cases. Require refresh_queue_hash equal its baseline. Require returned context db_role `postgres` and all JWT-setting hashes equal the clean context. The same-request post-rollback assertion also requires auth.uid() NULL and unset/empty sub/role/claims.
6. Store case name, artifact SHA256, request/result timestamps, baseline and final result, and explicit PASS/FAIL classification. Keep credentials and real user data out of evidence. A baseline mismatch caused by independent outside activity is inconclusive and requires investigation; do not overwrite the baseline or declare PASS.

Each artifact uses local statement_timeout 15 seconds and lock_timeout 5 seconds. Context setup is outside the expected-error subtransaction. Only the expected message pattern is accepted, then actor/role are checked again; a permission/context/setup failure cannot masquerade as a commerce denial.

**Unexpected error handling:** an error can prevent the later ROLLBACK and post-probe from being reached. The executor must roll back or close the same connection before any continuation. The local harness explicitly rolls back on its same PGlite connection. Connector connection disposal/rollback must be established by the executor; a new pooled query alone is not proof that an old transaction was closed. On transport ambiguity stop, inspect active calls read-only, and coordinate with root. No DELETE-based cleanup, retry through another executor, or global maintenance is authorized. Root already verified this connector executes an explicit BEGIN/SET LOCAL/SELECT/ROLLBACK/post-SELECT boundary successfully on PG17.6 using no data DML.

## Scope and current evidence

The 32 cases cover claimed deletion states processing/failed/blocked for checkout and fitting buyer/garage; ownerless response quote/decline/complete denial and owner success; detached-message buyer/owner/both denial; surviving buyer/garage and ordinary participant messages; admin exceptions with profile restoration; ordinary requested-deletion checkout/fitting; unbound service-role rejection for all four commerce RPCs; anonymous checkout ACL; and authenticated claim ACL.

Local final harness: 35/35 PASS, including the deliberate wrong-role regression, real captured deployed SQL/ACLs, rollback absence, profile timestamp/role restoration, and context restoration. This is reduced-schema PGlite evidence; it does not independently reproduce the entire hosted schema/RLS/trigger surface or concurrency. Root reports separate exact-body isolated PG17 evidence 67/67 PASS; its dedicated package carries concurrency proof. Full integrated validation is owned by root and is not duplicated here.

Root completed all **32/32 independently reviewed hosted cases PASS, 0 SQL assertion failures**, at `2026-10-08 15:53:05 UTC`. The authoritative root-owned record is `docs/test-runs/2026-10-08-hosted-rollback-results.json`; it was not modified by this specialist. Independent local validation of that record found all 32 case identities/statuses and SQL artifact hashes correct, all 14 counts zero per case, three buyer roles per case, profile_state_hash `1f2158062e367cab70bd872f96206959` restored, refresh_queue_hash `d751713988987e9331980363e24189ce` unchanged, and clean postgres context fields matching baseline. Profile state includes updated_at, including the admin cases. The exact v2 manifest hash remains `136DA66EB77271891E9B6F0872B895ADA0AC6F4743DE1DFA1E1040E38543ECDB`.

The same-request post-rollback assertions completed for all 32 cases. Root's fresh post-run readback found all five deployed MD5s and ACLs unchanged. No provider, Auth, Storage, global-worker, or cleanup endpoint was called by the final SQL acceptance run. Synthetic Auth Admin provisioning happened separately before these tests and does not establish mailbox lifecycle.

One mistyped project reference for owner-response-quote was rejected at the connector permission boundary, without a successful SQL result; the correctly targeted case passed. It is a recorded transport rejection, not a SQL assertion failure. Earlier request-state errors/cancellation and the unsafe shared committed plan are historical, superseded by the independently reviewed v2 package. The committed shared-host plan remains permanently rejected; it is not authorized by these execution notes. See the dedicated acceptance report for preserved history.

Residual gates remain real mailbox/browser lifecycle, normal Auth/Storage deletion worker completion, provider/payment E2E, physical Android/device evidence, and broader release gates. No claim that the whole deletion system or SecondPart release is safe follows from these synthetic cases.
