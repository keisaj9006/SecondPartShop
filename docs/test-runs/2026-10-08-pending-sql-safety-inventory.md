# Pending hosted SQL safety inventory — 2026-10-08

Status: **PAUSED; no hosted write is approved or active.** Owner explicitly stopped all destructive hosted operations, including rollback tests and cleanup. This report is local-only and authorizes no execution.

## Pending files and call status

- Exact submitted checkout batch: `C:\Users\joann\AppData\Local\Temp\secondpart-hosted-checkout-acceptance.sql`.
- Exact submitted full rollback batch: `C:\Users\joann\AppData\Local\Temp\secondpart-hosted-rollback-acceptance.sql`.
- Dedicated builders: `scripts/build-hosted-deletion-acceptance.mjs` and `scripts/build-hosted-deletion-concurrency.mjs`.
- No committed concurrency UUID manifest or executable setup/reset/race/cleanup file was built or submitted.
- Full rollback SQL calls twice returned connector `Invalid or expired requestState`. Smaller checkout call returned `SQL execution was cancelled`. No SQL acceptance result exists. No alternate executor was used.
- Fresh read-only `pg_stat_activity` result has no matching QA calls. Parts, sellers, garage_partners, account_deletion_requests, orders, fitting_requests and notifications for this run each count **0**. All three tagged Auth identities/profiles remain present with role buyer. These zero counts are point-in-time evidence, not proof that a transient aborted transaction never existed.
- The only successful hosted behavioral test was four unbound service-role RPC denials; it created no fixtures.
- The identities were created by the root through Auth Admin solely for synthetic authorization evidence, with `qa_evidence_class=synthetic-not-mailbox`. No normal signup/email lifecycle PASS is claimed.

## Actual pending checkout fixture writes

The checkout batch inserts new synthetic rows into `public.sellers`, `public.seller_payment_accounts`, `public.parts`, `public.garage_partners` (two garages), and `public.account_deletion_requests` (two requests). IDs for child fixtures are generated inside the block; three existing newly provisioned tagged test profiles are used only as parents/actors.

It calls actual `prepare_checkout_order`, which inserts `orders`, `order_items`, `order_events` and updates fixture part stock/status. It calls actual `claim_account_deletion_request`, which updates the deletion request, archives owned seller inventory, and suspends owned garage partners. The fixture seller owner is NULL; the actor owns only the new fixture garage, so the intended inventory/garage targets are confined to fixture children.

The exact explicit DELETE/UPDATE statements below are in addition to those function effects. There is **no DROP, TRUNCATE, schema/function replacement, RLS change, direct Auth write, provider call or Storage object mutation** in this batch.

```sql
delete from public.order_events where order_id in(select id from public.orders where buyer_id=b);
```

```sql
delete from public.order_items where part_id=p;
```

```sql
delete from public.orders where buyer_id=b;
```

```sql
update public.parts set stock=2,status='active' where id=p;
```

```sql
update public.account_deletion_requests set status='requested',attempt_count=0 where id=br;
```

The intended success path raises a private sentinel inside an exception subtransaction, rolling back all fixture DML and trigger writes. Unexpected errors abort the entire SQL request. Expected permanent database row effects are **zero**. SQL request-role settings are transaction-local. No completion or successful rollback result was obtained, so this is intended behavior rather than observed acceptance.

## Full rollback superset

The larger pending file additionally seeds fitting workflows, changes only synthetic fitting/garage/deletion state, tests denial and positive contracts, and temporarily updates the newly provisioned stranger profile to admin inside the rollback boundary. It inserts fitting requests, fitting messages and notifications through actual functions. It is not the normal destructive deletion runbook and cannot establish Auth hard deletion, mailbox confirmation, external Storage cleanup or provider payment.

All distinct explicit DELETE/UPDATE statements in that exact larger file are listed here; no DROP/TRUNCATE is present:

```sql
delete from public.order_events where order_id in(select id from public.orders where buyer_id=b);
```

```sql
delete from public.order_items where part_id=p;
```

```sql
delete from public.orders where buyer_id=b;
```

```sql
update public.parts set stock=2,status='active' where id=p;
```

```sql
update public.account_deletion_requests set status='requested',attempt_count=0 where id=br;
```

```sql
update public.account_deletion_requests set status='failed',attempt_count=1 where id=br;
```

```sql
update public.account_deletion_requests set status='blocked',attempt_count=1 where id=br;
```

```sql
update public.garage_partners set status='active' where id=bg;
```

```sql
update public.fitting_requests set status='requested' where id=f;
```

```sql
update public.account_deletion_requests set status='requested',attempt_count=0 where id in(br,gr);
```

```sql
update public.fitting_requests set status='quoted' where id=f;
```

```sql
update public.fitting_requests set status='accepted' where id=f;
```

```sql
update public.fitting_requests set status='cancelled' where id=f;
```

```sql
update public.account_deletion_requests set status='requested',attempt_count=0 where id=gr;
```

```sql
update public.garage_partners set status='active' where id=g;
```

```sql
update public.account_deletion_requests set status='processing',attempt_count=1 where id=gr;
```

```sql
update public.account_deletion_requests set status='failed',attempt_count=1 where id=gr;
```

```sql
update public.account_deletion_requests set status='blocked',attempt_count=1 where id=gr;
```

```sql
update public.account_deletion_requests set status='cancelled' where id in(br,gr);
```

```sql
update public.garage_partners set owner_id=null,status='active' where id=g;
```

```sql
update public.fitting_requests set status='accepted',buyer_id=null where id=f;
```

```sql
update public.garage_partners set owner_id=go where id=g;
```

```sql
update public.fitting_requests set status='accepted',buyer_id=b where id=f;
```

```sql
update public.garage_partners set owner_id=null where id=g;
```

```sql
update public.fitting_requests set buyer_id=b,status='accepted' where id=f;
```

```sql
update public.fitting_requests set buyer_id=null where id=f;
```

```sql
update public.fitting_requests set buyer_id=b,status='requested' where id=f;
```

```sql
update public.profiles set role='admin' where id=s;
```

## Rejected committed concurrency design

The unexecuted concurrency builder is **unsafe to approve as written**:

- A committed active part and active garages permit unrelated authenticated fitting requests, despite the synthetic seller being payment-unready.
- Reset/cleanup select fitting rows by part+garage without buyer provenance.
- Whole orders are selected through any fixture item; that could include an order containing other items.
- Cleanup lacks a provider-state guard.
- Reset's `buyer_id NOT IN (...)` guard is nullable and does not reject a detached buyer.

No setup/reset/race/cleanup was executed. Do not execute these templates, use another executor, or treat owner approval of this report as approval of them. Root recommends separate rollback cases or an isolated database. Expected permanent effects, if the unsafe design were executed, would include briefly public active fixture rows, committed order/fitting/deletion states, notification/queue rows, then destructive cleanup with the defects above. Those effects are deliberately **not authorized**.

The generator's explicit mutation targets are: setup INSERTs sellers/seller_payment_accounts/parts/garage_partners/account_deletion_requests; reset DELETEs order_events/orders/fitting_requests/notifications and UPDATEs seller_payment_accounts/parts/garage_partners/account_deletion_requests; checkout race temporarily UPDATEs seller_payment_accounts; cleanup DELETEs fitting_requests/order_events/orders/notifications/account_deletion_requests/garage_partners/private.saved_search_match_queue/parts/sellers. There is no DROP/TRUNCATE or direct Auth mutation in the generator.

## Read-only dependencies versus indirect writes

Explicit checkout/blocker/trigger reads include:
`account_deletion_requests`, `parts`, `sellers`, `commerce_settings`, `orders`, `order_items`, `garage_partners`, `transaction_cases`, `fitting_requests`, `marketplace_reports`, `categories`, `part_catalogue_fitments`, `part_requests`, `part_images`, `mobile_push_devices`. `seller_checkout_ready` additionally reads `seller_payment_accounts`; `is_admin` reads `profiles`. `auth.uid()` reads request settings, not Auth rows. Dormant validation callbacks additionally read `transaction_reviews` and `private.case_evidence_cleanup`.

Possible indirect table writes:
- Parts INSERT/UPDATE/DELETE trigger helpers INSERT/UPSERT `private.part_request_refresh_queue`, including matching preexisting open requests selected by category ancestors/OEM/catalogue fitment signals.
- Parts active INSERT/UPDATE can INSERT/UPSERT `private.saved_search_match_queue` for the fixture part.
- Source-request part triggers can UPDATE `public.seller_part_request_matches` and INSERT `public.notifications`; the pending fixture leaves `source_request_id=NULL`, so those bodies return early.
- Notifications trigger INSERTs `public.mobile_push_outbox` for enabled devices. Fresh fixture identities have no push devices.
- Seller identity UPDATE can UPDATE `public.seller_verification_requests`; the checkout batch only inserts its seller and does not update identity fields.
- Order payment-status UPDATE to paid can UPDATE `public.part_requests`; the pending checkout batch never sets paid.
- Failed order-item state UPDATE can DELETE `public.transaction_reviews`; the pending batch inserts/deletes items without those state updates.
- Parts DELETE may INSERT `private.part_image_cleanup`; checkout-only batch does not delete parts.
- Row timestamp/protection triggers mutate NEW fields and perform their permission checks.

Trigger queue writes are real writes even when intended to roll back. Other transactions cannot see uncommitted rows under normal isolation, but this is not an exhaustive assertion about every possible external effect. No HTTP/dblink/Vault/cron/pg_notify marker was found in the inspected bodies; nested helpers and background workers beyond the inspected graph are not comprehensively proven.

## Recursive order/order-item deletion FK reachability

CASCADE targets: `order_items`, `order_events`, `transaction_reviews`, `transaction_cases`, `transaction_messages`, `verified_fit_feedback`, and `transaction_case_evidence` through cases. SET NULL targets: `payment_events.order_id`, `fitting_requests.order_item_id`. NO ACTION blockers: `private.provider_dispute_reversals.case_id` and `order_item_id`. All may be empty for an untouched fresh fixture; they are still reachable effects.

| Referencing table | Parent | Delete action | Exact definition |
| --- | --- | --- | --- |
| `order_items` | `orders` | CASCADE | `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE` |
| `transaction_reviews` | `order_items` | CASCADE | `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE` |
| `order_events` | `orders` | CASCADE | `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE` |
| `order_events` | `order_items` | CASCADE | `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE` |
| `payment_events` | `orders` | SET NULL | `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL` |
| `transaction_cases` | `order_items` | CASCADE | `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE` |
| `transaction_messages` | `order_items` | CASCADE | `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE` |
| `transaction_case_evidence` | `transaction_cases` | CASCADE | `FOREIGN KEY (case_id) REFERENCES transaction_cases(id) ON DELETE CASCADE` |
| `verified_fit_feedback` | `order_items` | CASCADE | `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE` |
| `fitting_requests` | `order_items` | SET NULL | `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL` |
| `private.provider_dispute_reversals` | `transaction_cases` | NO ACTION | `FOREIGN KEY (case_id) REFERENCES transaction_cases(id)` |
| `private.provider_dispute_reversals` | `order_items` | NO ACTION | `FOREIGN KEY (order_item_id) REFERENCES order_items(id)` |

The custom triggers inspected on the cascade closure are INSERT/UPDATE-only; none is a DELETE trigger. Their definitions are included below. This does not remove FK effects.

## Complete inspected fixture trigger inventory

- `garage_partners.garage_partners_protect_review` → `private.protect_garage_partner_review()`

```sql
CREATE TRIGGER garage_partners_protect_review BEFORE INSERT OR UPDATE ON public.garage_partners FOR EACH ROW EXECUTE FUNCTION private.protect_garage_partner_review()
```

- `garage_partners.garage_partners_touch` → `private.touch_updated_at()`

```sql
CREATE TRIGGER garage_partners_touch BEFORE UPDATE ON public.garage_partners FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()
```

- `notifications.enqueue_mobile_push_trigger` → `private.enqueue_mobile_push()`

```sql
CREATE TRIGGER enqueue_mobile_push_trigger AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.enqueue_mobile_push()
```

- `order_items.order_items_prevent_duplicate_active_reservation` → `private.prevent_duplicate_active_part_reservation()`

```sql
CREATE TRIGGER order_items_prevent_duplicate_active_reservation BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION private.prevent_duplicate_active_part_reservation()
```

- `order_items.remove_reviews_for_failed_order_item` → `private.remove_reviews_for_failed_order_item()`

```sql
CREATE TRIGGER remove_reviews_for_failed_order_item AFTER UPDATE OF refunded_at, fulfilment_status, payout_status ON public.order_items FOR EACH ROW EXECUTE FUNCTION private.remove_reviews_for_failed_order_item()
```

- `orders.close_fulfilled_part_requests_trigger` → `private.close_fulfilled_part_requests()`

```sql
CREATE TRIGGER close_fulfilled_part_requests_trigger AFTER UPDATE OF payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION private.close_fulfilled_part_requests()
```

- `orders.orders_limit_active_checkout_reservations` → `private.limit_active_checkout_orders()`

```sql
CREATE TRIGGER orders_limit_active_checkout_reservations BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.limit_active_checkout_orders()
```

- `orders.orders_touch` → `private.touch_updated_at()`

```sql
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()
```

- `parts.mark_part_request_match_responded_trigger` → `private.mark_part_request_match_responded()`

```sql
CREATE TRIGGER mark_part_request_match_responded_trigger AFTER INSERT OR UPDATE OF source_request_id, status ON public.parts FOR EACH ROW EXECUTE FUNCTION private.mark_part_request_match_responded()
```

- `parts.notify_buyer_for_request_listing_trigger` → `private.notify_buyer_for_request_listing()`

```sql
CREATE TRIGGER notify_buyer_for_request_listing_trigger AFTER INSERT OR UPDATE OF status, source_request_id ON public.parts FOR EACH ROW EXECUTE FUNCTION private.notify_buyer_for_request_listing()
```

- `parts.parts_enforce_activation_readiness_insert` → `private.enforce_listing_activation_readiness()`

```sql
CREATE TRIGGER parts_enforce_activation_readiness_insert BEFORE INSERT ON public.parts FOR EACH ROW EXECUTE FUNCTION private.enforce_listing_activation_readiness()
```

- `parts.parts_enforce_activation_readiness_update` → `private.enforce_listing_activation_readiness()`

```sql
CREATE TRIGGER parts_enforce_activation_readiness_update BEFORE UPDATE OF status, category_id, donor_vehicle_id, oem_number, manufacturer, part_number, gearbox_family, gearbox_code ON public.parts FOR EACH ROW EXECUTE FUNCTION private.enforce_listing_activation_readiness()
```

- `parts.parts_queue_images_before_delete` → `private.queue_part_images_before_parent_delete()`

```sql
CREATE TRIGGER parts_queue_images_before_delete BEFORE DELETE ON public.parts FOR EACH ROW EXECUTE FUNCTION private.queue_part_images_before_parent_delete()
```

- `parts.parts_touch` → `private.touch_updated_at()`

```sql
CREATE TRIGGER parts_touch BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()
```

- `parts.queue_find_my_part_after_parts_delete` → `private.queue_requests_after_parts_delete()`

```sql
CREATE TRIGGER queue_find_my_part_after_parts_delete AFTER DELETE ON public.parts REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION private.queue_requests_after_parts_delete()
```

- `parts.queue_find_my_part_after_parts_insert` → `private.queue_requests_after_parts_insert()`

```sql
CREATE TRIGGER queue_find_my_part_after_parts_insert AFTER INSERT ON public.parts REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.queue_requests_after_parts_insert()
```

- `parts.queue_find_my_part_after_parts_update` → `private.queue_requests_after_parts_update()`

```sql
CREATE TRIGGER queue_find_my_part_after_parts_update AFTER UPDATE ON public.parts REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.queue_requests_after_parts_update()
```

- `parts.queue_saved_search_matches_after_insert` → `private.queue_saved_search_matches_after_insert()`

```sql
CREATE TRIGGER queue_saved_search_matches_after_insert AFTER INSERT ON public.parts REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.queue_saved_search_matches_after_insert()
```

- `parts.queue_saved_search_matches_after_update` → `private.queue_saved_search_matches_after_update()`

```sql
CREATE TRIGGER queue_saved_search_matches_after_update AFTER UPDATE ON public.parts REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION private.queue_saved_search_matches_after_update()
```

- `seller_payment_accounts.seller_payment_accounts_touch` → `private.touch_updated_at()`

```sql
CREATE TRIGGER seller_payment_accounts_touch BEFORE UPDATE ON public.seller_payment_accounts FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()
```

- `sellers.protect_seller_verification_trigger` → `private.protect_seller_verification()`

```sql
CREATE TRIGGER protect_seller_verification_trigger BEFORE INSERT OR UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION private.protect_seller_verification()
```

- `sellers.seller_identity_change_cancels_pending_verification` → `private.cancel_pending_seller_verification_on_identity_change()`

```sql
CREATE TRIGGER seller_identity_change_cancels_pending_verification AFTER UPDATE OF business_name, seller_type, business_kind, location, postcode ON public.sellers FOR EACH ROW EXECUTE FUNCTION private.cancel_pending_seller_verification_on_identity_change()
```

- `sellers.sellers_touch` → `private.touch_updated_at()`

```sql
CREATE TRIGGER sellers_touch BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()
```

## Complete inspected fixture/reachable FK inventory

- `order_items` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT`
- `order_items` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT`
- `order_items` → `orders`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `parts` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT`
- `parts` → `categories`: `FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT`
- `part_images` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `part_fitments` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `saved_parts` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `part_catalogue_fitments` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `donor_vehicles` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE`
- `parts` → `donor_vehicles`: `FOREIGN KEY (donor_vehicle_id) REFERENCES donor_vehicles(id) ON DELETE SET NULL`
- `recently_viewed_parts` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `seller_verification_requests` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE`
- `marketplace_reports` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `marketplace_reports` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE`
- `parts` → `part_requests`: `FOREIGN KEY (source_request_id) REFERENCES part_requests(id) ON DELETE SET NULL`
- `notifications` → `profiles`: `FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `transaction_reviews` → `order_items`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE`
- `order_events` → `orders`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `order_events` → `order_items`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE`
- `order_events` → `profiles`: `FOREIGN KEY (actor_profile_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `seller_payment_accounts` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE`
- `payment_events` → `orders`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL`
- `seller_inventory_imports` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE`
- `parts` → `seller_inventory_imports`: `FOREIGN KEY (import_batch_id) REFERENCES seller_inventory_imports(id) ON DELETE SET NULL`
- `transaction_cases` → `order_items`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE`
- `transaction_messages` → `order_items`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE`
- `listing_conversations` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `listing_conversations` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE`
- `order_items` → `vehicle_catalogue_variants`: `FOREIGN KEY (buyer_vehicle_variant_id) REFERENCES vehicle_catalogue_variants(id) ON DELETE SET NULL`
- `verified_fit_feedback` → `order_items`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE`
- `verified_fit_feedback` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `seller_part_request_matches` → `sellers`: `FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE`
- `seller_part_request_matches` → `parts`: `FOREIGN KEY (responded_part_id) REFERENCES parts(id) ON DELETE SET NULL`
- `private.part_request_refresh_queue` → `part_requests`: `FOREIGN KEY (request_id) REFERENCES part_requests(id) ON DELETE CASCADE`
- `private.saved_search_match_queue` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE`
- `fitting_requests` → `parts`: `FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT`
- `fitting_requests` → `garage_partners`: `FOREIGN KEY (garage_partner_id) REFERENCES garage_partners(id) ON DELETE RESTRICT`
- `fitting_requests` → `order_items`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL`
- `mobile_push_outbox` → `notifications`: `FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE`
- `mobile_push_outbox` → `profiles`: `FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE`
- `mobile_push_outbox` → `mobile_push_devices`: `FOREIGN KEY (device_id) REFERENCES mobile_push_devices(id) ON DELETE CASCADE`
- `account_deletion_requests` → `profiles`: `FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `orders` → `profiles`: `FOREIGN KEY (buyer_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `sellers` → `profiles`: `FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `garage_partners` → `profiles`: `FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL`
- `private.provider_dispute_reversals` → `order_items`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id)`

## Complete inspected function inventory

Table references below were extracted from actual captured function bodies and reviewed; delegated helper calls are listed so absence of direct writes is not confused with no indirect effect. Protection/timestamp triggers can alter NEW fields without a table DML statement.

| Function | Direct table reads | Direct table writes | Delegated calls |
| --- | --- | --- | --- |
| `private.touch_updated_at()` | — | — | — |
| `private.protect_seller_verification()` | — | — | `private.is_admin()` |
| `private.notify_buyer_for_request_listing()` | `public.part_requests` | `public.notifications` | `public.notifications()` |
| `prepare_checkout_order(uuid,integer,text)` | `public.account_deletion_requests`, `public.parts`, `public.sellers`, `public.commerce_settings` | `public.orders`, `public.order_items`, `public.parts`, `public.order_events` | `public.prepare_checkout_order()`, `auth.uid()`, `public.seller_checkout_ready()`, `public.orders()`, `public.order_items()`, `public.order_events()` |
| `private.limit_active_checkout_orders()` | `public.orders` | — | — |
| `private.prevent_duplicate_active_part_reservation()` | `public.orders`, `public.order_items` | — | — |
| `private.remove_reviews_for_failed_order_item()` | — | `public.transaction_reviews` | — |
| `private.mark_part_request_match_responded()` | — | `public.seller_part_request_matches` | — |
| `private.enqueue_part_request_refresh_for_part_signals(uuid[],text[],uuid[])` | `public.categories`, `public.part_catalogue_fitments`, `public.part_requests` | `private.part_request_refresh_queue` | `private.part_request_refresh_queue()` |
| `private.queue_requests_after_parts_insert()` | — | — | `private.enqueue_part_request_refresh_for_part_signals()` |
| `private.queue_requests_after_parts_delete()` | — | — | `private.enqueue_part_request_refresh_for_part_signals()` |
| `private.queue_requests_after_parts_update()` | — | — | `private.enqueue_part_request_refresh_for_part_signals()` |
| `private.queue_saved_search_matches_after_insert()` | — | `private.saved_search_match_queue` | `private.saved_search_match_queue()` |
| `private.queue_saved_search_matches_after_update()` | — | `private.saved_search_match_queue` | `private.saved_search_match_queue()` |
| `private.enforce_listing_activation_readiness()` | `public.categories`, `public.part_images`, `public.part_catalogue_fitments` | — | `public.seller_checkout_ready()` |
| `private.cancel_pending_seller_verification_on_identity_change()` | — | `public.seller_verification_requests` | — |
| `private.protect_garage_partner_review()` | — | — | `private.is_admin()` |
| `private.enqueue_mobile_push()` | `public.mobile_push_devices` | `public.mobile_push_outbox` | `public.mobile_push_outbox()` |
| `private.close_fulfilled_part_requests()` | `public.order_items`, `public.parts` | `public.part_requests` | — |
| `private.account_deletion_blocker(uuid)` | `public.sellers`, `public.garage_partners`, `public.orders`, `public.order_items`, `public.transaction_cases`, `public.fitting_requests`, `public.marketplace_reports` | — | — |
| `claim_account_deletion_request(uuid)` | `public.account_deletion_requests`, `public.parts`, `public.sellers`, `public.garage_partners` | `public.account_deletion_requests`, `public.parts`, `public.garage_partners` | `public.claim_account_deletion_request()`, `private.account_deletion_blocker()` |
| `private.queue_part_images_before_parent_delete()` | `public.sellers`, `public.part_images` | `private.part_image_cleanup` | `auth.uid()`, `private.is_admin()`, `private.part_image_cleanup()` |
| `private.validate_transaction_review()` | `public.order_items`, `public.orders`, `public.sellers` | — | — |
| `private.publish_review_pair()` | `public.transaction_reviews` | `public.transaction_reviews` | — |
| `private.audit_transaction_case_status_change()` | `public.order_items` | `public.order_events` | `public.order_events()`, `auth.uid()` |
| `private.remove_reviews_for_lost_provider_dispute()` | — | `public.transaction_reviews` | — |
| `private.enforce_transaction_review_terms()` | — | — | `auth.uid()`, `private.is_admin()`, `private.has_current_marketplace_terms()` |
| `private.enforce_verified_fit_terms()` | — | — | `auth.uid()`, `private.is_admin()`, `private.has_current_marketplace_terms()` |
| `private.guard_case_evidence_cleanup_registration()` | `private.case_evidence_cleanup` | — | — |
| `public.seller_checkout_ready(uuid)` | `public.sellers`, `public.seller_payment_accounts` | — | — |
| `private.is_admin()` | `public.profiles` | — | `auth.uid()` |
| `auth.uid()` | Request settings only | — | — |

No external-call markers were found in the 29 inspected commerce/trigger/cascade callback bodies. The terms-gate nested helpers and any unrelated scheduler/provider-worker execution are not exhaustively inventoried.

## Cascade closure custom triggers

- `transaction_reviews.validate_transaction_review_trigger`: `CREATE TRIGGER validate_transaction_review_trigger BEFORE INSERT ON public.transaction_reviews FOR EACH ROW EXECUTE FUNCTION private.validate_transaction_review()`
- `transaction_reviews.publish_review_pair_trigger`: `CREATE TRIGGER publish_review_pair_trigger AFTER INSERT ON public.transaction_reviews FOR EACH ROW EXECUTE FUNCTION private.publish_review_pair()`
- `orders.orders_touch`: `CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()`
- `transaction_cases.transaction_cases_touch`: `CREATE TRIGGER transaction_cases_touch BEFORE UPDATE ON public.transaction_cases FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()`
- `transaction_cases.transaction_case_status_audit`: `CREATE TRIGGER transaction_case_status_audit AFTER UPDATE OF status ON public.transaction_cases FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION private.audit_transaction_case_status_change()`
- `orders.orders_limit_active_checkout_reservations`: `CREATE TRIGGER orders_limit_active_checkout_reservations BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.limit_active_checkout_orders()`
- `order_items.order_items_prevent_duplicate_active_reservation`: `CREATE TRIGGER order_items_prevent_duplicate_active_reservation BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION private.prevent_duplicate_active_part_reservation()`
- `order_items.remove_reviews_for_failed_order_item`: `CREATE TRIGGER remove_reviews_for_failed_order_item AFTER UPDATE OF refunded_at, fulfilment_status, payout_status ON public.order_items FOR EACH ROW EXECUTE FUNCTION private.remove_reviews_for_failed_order_item()`
- `transaction_cases.remove_reviews_for_lost_provider_dispute`: `CREATE TRIGGER remove_reviews_for_lost_provider_dispute AFTER UPDATE OF provider_dispute_status ON public.transaction_cases FOR EACH ROW EXECUTE FUNCTION private.remove_reviews_for_lost_provider_dispute()`
- `orders.close_fulfilled_part_requests_trigger`: `CREATE TRIGGER close_fulfilled_part_requests_trigger AFTER UPDATE OF payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION private.close_fulfilled_part_requests()`
- `transaction_reviews.transaction_reviews_terms_gate`: `CREATE TRIGGER transaction_reviews_terms_gate BEFORE INSERT ON public.transaction_reviews FOR EACH ROW EXECUTE FUNCTION private.enforce_transaction_review_terms()`
- `verified_fit_feedback.verified_fit_feedback_terms_gate`: `CREATE TRIGGER verified_fit_feedback_terms_gate BEFORE INSERT OR UPDATE OF result, notes ON public.verified_fit_feedback FOR EACH ROW EXECUTE FUNCTION private.enforce_verified_fit_terms()`
- `transaction_case_evidence.case_evidence_cleanup_registration_guard`: `CREATE TRIGGER case_evidence_cleanup_registration_guard BEFORE INSERT OR UPDATE OF storage_path ON public.transaction_case_evidence FOR EACH ROW EXECUTE FUNCTION private.guard_case_evidence_cleanup_registration()`

## Remaining approval boundary

All hosted writes remain paused. Approval must identify an exact safe SQL operation and its actual permanent/temporary effects. The unsafe committed concurrency generator should not be approved. Synthetic role-context verification and true normal mailbox/deletion lifecycle remain separate evidence classes.
