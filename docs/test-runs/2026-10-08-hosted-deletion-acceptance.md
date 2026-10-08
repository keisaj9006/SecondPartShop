# Hosted synthetic deletion authorization acceptance — 2026-10-08

**Final bounded result: 32/32 hosted rollback-only cases PASS, 0 SQL assertion failures**, completed at `2026-10-08 15:53:05 UTC` on Preview Supabase project `etkupijfdznljimrfyct`, PostgreSQL 17.6. Root executed the independently reviewed exact v2 artifacts and owns the immutable result record: [hosted rollback results](2026-10-08-hosted-rollback-results.json).

This is synthetic SQL transaction-only evidence. It does not establish real mailbox/browser lifecycle, Auth hard deletion, external Storage cleanup, provider/payment E2E, or true hosted concurrency. No provider, Auth, Storage, global worker, or cleanup endpoint was called by the final SQL acceptance run. The three synthetic identities had previously been provisioned separately by root through Auth Admin; that provisioning is not mailbox evidence.

## Exact reviewed package and authorization

The owner authorized safe independent rollback-only tests after rejecting committed shared-host concurrency fixtures. Every final case used fresh fixture UUIDs, one `BEGIN`, explicit role/actor assertions, one tested RPC behavior, one `ROLLBACK`, and post-rollback absence/context probes within the same submitted SQL artifact. There are no DELETE resets, COMMITs, schema/function/RLS changes, existing owner/customer mutation targets, or fixture reuse.

Artifact directory: `C:\Users\joann\AppData\Local\Temp\secondpart-rollback-only-20261008-v2`. Manifest SHA256: `136DA66EB77271891E9B6F0872B895ADA0AC6F4743DE1DFA1E1040E38543ECDB`. Independent review checked all 32 exact SQL files and 160 unique fixture UUIDs. The final local actual-deployed-body reduced-schema harness passed 35/35, including rollback restoration and a deliberately wrong-context rejection.

The tagged synthetic identity metadata required `qa_run_id=rc26-hosted-20261008-autonomous` and `qa_evidence_class=synthetic-not-mailbox`; all three profiles began and ended in buyer mode. Fixture preflight required empty commerce/deletion/garage/notification parents and no enabled push devices. Temporary synthetic-admin profile role updates occurred only inside their own rolled-back cases.

The applied repair is `20261008130523_account_deletion_checkout_fitting_serialization`. The exact deployed snapshot at `2026-10-08 15:28:54 UTC` is [deployed function definitions and grants](2026-10-08-deployed-deletion-functions.json). Root's fresh post-run readback found all five definition MD5s and ACLs unchanged. Commerce RPCs retain postgres/authenticated/service_role execution; claim retains postgres/service_role execution. The tests made no function or grant changes.

## Hosted cases and restoration evidence

| Coverage | Cases | Result |
| --- | ---: | --- |
| Checkout/fitting buyer/fitting garage claimed-deletion guards: processing, failed, blocked | 9 | PASS |
| Ownerless quote/decline/complete denied; actual owner quote/decline/complete allowed | 6 | PASS |
| Stranger messages denied when retained buyer, owner, or both are NULL | 3 | PASS |
| Buyer, garage, surviving buyer and surviving garage messages allowed | 4 | PASS |
| Admin ownerless response and detached message with profile restoration | 2 | PASS |
| Ordinary checkout/fitting while deletion is only requested | 2 | PASS |
| Unbound service requests rejected by all four commerce RPCs | 4 | PASS |
| Anonymous checkout and authenticated deletion-claim ACL denial | 2 | PASS |

Every case returned all 14 fixture counts as numeric zero after ROLLBACK: sellers, seller_payment_accounts, parts, garage_partners, account_deletion_requests, fitting_requests, fitting_request_messages, order_items, orders, order_events, notifications, mobile_push_outbox, saved_search_queue, and part_image_cleanup. There were no committed fixture children.

Every case restored exactly three buyer profile roles and profile_state_hash `1f2158062e367cab70bd872f96206959`, which includes IDs, roles, and updated_at. Both admin cases therefore restored profile timestamps as well as role values. The request refresh queue hash remained `d751713988987e9331980363e24189ce`. All post-rollback contexts were postgres with clean sub/role/claims hashes `ec11e5e3aaf1ce91bd7cbe6e90282612`; each same-request assertion also required auth.uid() NULL and empty/unset claims. A separately pooled context observation is not used as proof of session-state restoration.

This specialist independently checked the local root-owned result JSON against all 32 exact SQL artifact SHA256s: case identity/status, 14 zero counts, three buyer roles, profile/queue baseline equality, clean context fields, and suite totals all passed. Root owns the recorded hosted outputs; this specialist did not duplicate execution or alter the results JSON.

One `owner-response-quote` transport attempt used a mistyped project reference and was rejected at the connector permission boundary. It produced no successful SQL assertion result and is recorded as a transport rejection, not a deployed-function failure. The correctly targeted reviewed case subsequently passed. Earlier paused/cancelled requests described below are not included in the final 32 PASS count.

## Inspected dependency boundary

The actual SECURITY DEFINER bodies were exercised under SQL role-context settings; auth.uid() reads those transaction-local claims and private.is_admin() reads the synthetic profile role. They do not simulate signed browser credentials. The authenticated claim case was denied by the actual ACL and did not successfully claim or process deletion.

Reviewed part triggers can enqueue private request-refresh and saved-search rows, and notifications can enqueue push outbox rows. Fresh category/catalogue preconditions, absent source/OEM signals, zero fixture devices, in-transaction queue checks, and rollback probes bound these paths. Retained fitting authorization fixtures use draft parts and pending garages; active listings and checkout readiness exist only within uncommitted normal-creator cases. No external call was found in the inspected dependency bodies; this is not an exhaustive assertion about all extensions or future deployments.

Detailed dependencies and historical FK cascade inventory: [pending SQL safety inventory](2026-10-08-pending-sql-safety-inventory.md). Current exact execution boundaries and mandatory result checks: [rollback review notes](2026-10-08-hosted-rollback-review.md).

## Superseded attempts and permanently rejected plan

Before the rollback-only refactor, a fixture builder used shared reset/subtransaction patterns and a planned committed concurrency package. Two attempted full-suite requests returned connector request-state errors; a smaller checkout batch was cancelled. These attempts yielded no fixture acceptance PASS. At the explicit owner safety stop, fresh read-only checks found no matching active QA call, zero run fixture artifacts, and three intact tagged buyer profiles. The earlier four no-fixture unbound-service checks had rejected Authentication required, but the final package retested all four under explicit independently reviewed boundaries.

Independent review found the old committed concurrency package unsafe: public active part/garage fixtures could receive unrelated fitting requests; cleanup lacked buyer provenance, selected whole orders through any fixture item, and lacked provider-state guards; a reset NOT IN buyer check was nullable. The package was never executed and is permanently rejected for the shared hosted database. The old pending SQL files and their cleanup/reset strategy are superseded evidence, not executable instructions. True overlap coverage belongs to a disposable isolated PG17 database using exact deployed functions; root reports 67/67 isolated cases PASS in its separate package.

The earlier pause/pending/no-PASS statements apply only to those superseded attempts. The owner later authorized the reviewed independent rollback-only package, resulting in the 32/32 final hosted PASS above. No additional hosted execution or cleanup is needed for this evidence update.

## Remaining gates

These results close the bounded SQL acceptance checks for the repaired creator guards and retained fitting authorization. They do not certify the entire deletion system or release. Real mailbox/browser authentication, normal Auth/Storage worker completion, provider/payment E2E, Android physical-device checks, and broader release gates remain separately tracked by root.
