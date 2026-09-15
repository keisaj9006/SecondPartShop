# SecondPart P0 RLS, Storage and critical communication evidence — 2026-09-15

## Scope and safety

Evidence was collected only on `rebuild-nextjs`, Vercel Preview and QA Supabase (`etkupijfdznljimrfyct`). No Production or real-money operations were used. Hosted mutation probes were wrapped in explicit transactions followed by `ROLLBACK`. No real email, FCM push or external alert was sent.

Final clean code boundary before this documentation commit: `03b62cfb0747cda006d6c0158097b80fcf2f459a`.

- GitHub Actions run `34998569234`: full PASS.
- Exact Vercel Preview deployment `dpl_AZjvFjkjmTYdgTjs1TGNfYrozjzp`: READY, exact SHA `03b62cfb0747cda006d6c0158097b80fcf2f459a`.
- Temporary `/qa/actor-switch` and `/api/qa/actor-switch` both return HTTP 404 on that clean deployment.

## 1. RLS and private-data boundaries

Live PostgreSQL inspection confirms RLS is enabled on critical marketplace/private tables including:

- `orders`
- `order_items`
- `parts`
- `part_images`
- `profiles`
- `sellers`
- `transaction_cases`
- `support_requests`
- `support_request_messages`
- `support_request_internal_notes`
- `storage.objects`

Key deployed policies/helpers were inspected rather than inferring protection from advisor output alone.

### Marketplace records and part images

`parts` and `part_images` policies expose active marketplace data publicly while keeping seller-owned draft data owner/admin scoped.

The deployed `private.can_upload_part_image(path)` additionally requires:

- authenticated actor;
- path prefix equal to the actor profile ID;
- exact owned part ID in the path;
- seller/admin profile role;
- part not `reserved`;
- no in-progress deletion state;
- no pending cleanup authority for the exact path;
- row/advisory locking before authorizing the path.

`storage.objects` has explicit client UPDATE/DELETE denial for `part-images`. Supabase's own `storage.protect_delete()` also rejected a direct object-table DELETE attempt with SQLSTATE `42501`, providing an additional provider storage safety boundary.

### Case evidence

The deployed case-evidence helper contract is participant-scoped:

- `private.can_read_case_evidence_object(path)` resolves the case ID from the first path segment and allows an order-item participant or admin;
- `private.can_upload_case_evidence_object(path)` additionally requires the second path segment to equal `auth.uid()` and rejects `resolved`, `rejected` and `cancelled` cases.

### Hosted PostgreSQL/RLS probes

Using existing QA identities and fixtures:

1. An unrelated buyer could not read another seller's draft part, its `part_images` metadata or its private `storage.objects` part-image row.
2. The seller owner could read its own draft part/image/object.
3. Authenticated-client UPDATE of the `part-images` object matched zero writable rows; direct DELETE was blocked by RLS/storage protection.
4. `can_upload_part_image` returned true for an owned draft path, false for an outsider, and false once the part was temporarily `reserved` inside the rollback transaction.
5. With the resolved QA return case temporarily set `open` only inside a rollback transaction, both buyer and seller participants could read the case-evidence namespace and upload only to their own actor subfolder; an outsider could neither read nor upload.
6. Returning the case to `resolved` made participant upload fail closed.

Post-rollback checks confirmed:

- photo fixture remains `draft`;
- QA refund case remains `resolved`;
- the checked Storage object still exists exactly once.

**Scoped result:** RLS/Storage ownership, draft privacy, participant boundaries and finality are VERIFIED on hosted PostgreSQL for the exercised paths. Existing cleanup/recovery regressions remain responsible for simulated metadata/byte/provider-failure ordering. A deliberate shared Storage outage was not induced and is not claimed as provider-outage PASS.

## 2. Notifications and transaction messaging

### Static/CI delivery contract

`validate-notification-delivery.mjs` is part of the full CI and passed at the clean code boundary. It currently checks 28 critical event paths for normal `schedulePushDispatch` use, Next `after()` dispatch scheduling, Android HIGH-priority transactional push, safe same-origin native action routing, normal notification → outbox → dispatcher architecture, processing-lease recovery and smoke-test safety.

The admin FCM smoke path explicitly states that server-side acceptance is not physical-device PASS and does not expose device tokens.

### Live RLS/grants

- `notifications`: RLS enabled; authenticated clients have own-row SELECT/UPDATE only.
- `transaction_messages`: RLS enabled; authenticated SELECT is participant-bound through `private.can_read_order_item`.
- `mobile_push_devices`: RLS enabled; base table privileges are service-role/postgres only.
- `mobile_push_outbox`: RLS enabled; base table privileges are service-role/postgres only.
- `claim_mobile_push_outbox(limit)`: service-role only; processing rows older than five minutes are recovered and bounded retries use `FOR UPDATE SKIP LOCKED`.

Hosted RLS probes confirmed a real buyer can read its own notification rows but zero seller rows, and the real seller can read its own rows but zero buyer rows.

### Genuine £89 provider-flow communication evidence

The real Stripe sandbox flow for order `6b816b03-9d35-4a15-a4f9-cad7357644f3` and case `e924aa7f-f117-4f30-849b-de611da11bdf` produced durable in-app notifications across the critical journey:

- buyer: `Payment received` (`order-paid:...:buyer`)
- seller: `New paid order` (`order-paid:...:seller:...`)
- buyer: `Your order is ready for collection`
- seller: `Buyer accepted the item`
- buyer: `Transaction completed`
- seller: `Buyer opened a return request`
- buyer: `Refund issued`
- seller: `Transaction refunded`

The rows carry bounded internal application routes and stable dedupe keys. This is durable database evidence from the genuine provider transaction, not a synthetic validator-only claim.

### Hosted transaction-message proof

The deployed `send_transaction_message(order_item_id, body)` function was inspected and exercised on the historical paid QA order inside a transaction followed by `ROLLBACK`:

- buyer → seller created a transaction message and counterpart `order_message` notification;
- seller → buyer created a transaction message and counterpart `order_message` notification;
- unrelated authenticated buyer was rejected as not a transaction participant;
- after rollback, the temporary probe messages count was exactly zero.

### Push delivery boundary

The QA buyer and QA seller profiles used for the £89 provider flow currently have zero rows in `mobile_push_devices`; consequently the observed notifications correctly produced no device-targeted `mobile_push_outbox` rows.

This does **not** prove physical FCM receipt. Physical-device FCM remains an EXTERNAL/manual gate requiring a registered test device and configured Firebase credentials. Likewise no real mailbox/email delivery or improvised alert destination was used.

**Scoped result:** critical in-app notification creation, deduplication, RLS isolation, transaction-message participant authorization and server-side push architecture are VERIFIED for the exercised boundaries. Physical FCM/email receipt remains unsigned/external.
