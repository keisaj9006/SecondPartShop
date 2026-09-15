# SecondPart P0 authorization, event ordering and Buyer Protection evidence — 2026-09-15

## Scope and safety

Evidence was collected only on `rebuild-nextjs`, Vercel Preview and QA Supabase (`etkupijfdznljimrfyct`). No Production or real-money operations were used. Hosted database mutation probes were wrapped in explicit transactions followed by `ROLLBACK`; durable QA records were re-read after the probes where relevant.

## 1. Roles and authorization

### Application boundary

The complete current `src/app/admin` surface was enumerated at the audited branch state. Current admin areas are:

- analytics
- beta-feedback
- commerce, including commerce/e2e and commerce/settings
- founding-sellers
- moderation
- privacy
- seller-prospects
- support/[requestId]
- system, including system/alerts and system/push-test

There is no shared `src/app/admin/layout.tsx`, so each current page/action was inspected individually rather than assuming a parent guard.

Every current admin page invokes `requireAdmin(...)` before privileged Supabase access. Every exported server action under the admin tree invokes `requireAdmin(...)` inside its own action before mutation/provider work.

A permanent regression test was added as `scripts/test-admin-authorization-boundary.mjs`. It recursively scans the current admin tree and requires:

- every `page.tsx` to invoke `requireAdmin` before creating a Supabase client;
- every exported async function in `actions.ts` to invoke `requireAdmin` inside that function;
- any future `route.ts` under `/admin` to carry the same explicit boundary.

Commit: `7bfb579a95e18b5efbd325f99510e685bb5dbfee`.

GitHub Actions run `34997934650` is fully GREEN: diff check, lint, typecheck, complete `npm test`, every release validator, production build, PostgreSQL last-stock concurrency and 100k marketplace-scale jobs all passed.

### Live Supabase RPC boundary

Financial/provider mutation RPCs such as checkout cancellation, paid confirmation, payout claim/finalization, refund finalization and provider dispute operations remain service-role only.

Admin-facing `admin_*` RPCs intentionally grant `authenticated` execution but perform a database-side `private.is_admin()` check before mutation. The deployed `private.is_admin()` resolves the current authenticated profile and requires `profiles.role = 'admin'`.

Real hosted negative probes used existing non-admin accounts with nonexistent target UUIDs and transaction rollback:

- existing buyer was denied on returnless refund preparation, silent-buyer payout review, seller verification review, marketplace report moderation and support reply;
- existing seller was denied on transaction-case refund preparation, return authorization, internal support note and support status change;
- existing buyer could not promote itself to `admin` through the profile-role trigger;
- the intended buyer-to-seller self-upgrade remained allowed inside the transaction, then was rolled back.

No tested cross-role probe mutated durable state.

### Preview anonymous boundary

Anonymous Preview requests to representative admin routes (`/admin/commerce`, `/admin/commerce/e2e`, `/admin/commerce/settings`, `/admin/moderation`, `/admin/system`) were redirected/rendered into the sign-in-required account flow rather than exposing admin content.

**Result:** the current admin/role authorization boundary is VERIFIED for the inspected application surface, live RPC guards, role-promotion guard and anonymous Preview boundary.

## 2. Delayed and out-of-order provider events

### Permanent regressions

`test-checkout-provider-ordering-sql.mjs` covers:

- paid webhook before local Checkout Session attachment remains retryable and does not consume the provider event;
- retry after correct attachment succeeds once;
- duplicate paid delivery creates no duplicate semantic transition;
- already-paid state wins against a delayed terminal Checkout event;
- provider-confirmed expiry first prevents a delayed paid event from resurrecting a cancelled order.

`test-provider-dispute-ordering.mjs` covers:

- dispute-created before the order/payment linkage remains retryable and unconsumed;
- dispute-closed before dispute-created remains retryable and later applies correctly;
- duplicate dispute open/close deliveries do not duplicate semantic events;
- a late provider dispute reuses the one already-active return case rather than violating the single-active-case invariant.

### Deployed webhook / function inspection

`/api/stripe/webhook` verifies the Stripe signature before parsing/processing. Successful Checkout events verify stored session correlation, amount/currency, successful PaymentIntent metadata/amount/currency and charge linkage before invoking `confirm_checkout_paid`.

`payment_intent.payment_failed` does not directly release inventory; it reconciles the authoritative Checkout Session state. Terminal Checkout events use `cancel_checkout_order_from_provider_event` and are ignored when they do not have authority over the current order state.

The deployed PostgreSQL functions `confirm_checkout_paid`, `cancel_checkout_order_from_provider_event`, `open_provider_payment_dispute` and `close_provider_payment_dispute` are service-role only. Inspection confirms event IDs are not durably consumed before the prerequisite order/case linkage exists.

### Hosted PostgreSQL 17 rollback proofs

Using the existing cancelled/completed QA orders only inside transactions followed by `ROLLBACK`, the deployed functions passed these assertions:

1. paid event before session attachment failed without consuming its event ID;
2. the same event succeeded after correct attachment and its replay did not create another transition;
3. a delayed expiry after paid returned no cancellation authority and its event was not consumed;
4. expiry-first cancelled exactly once; duplicate terminal delivery did not duplicate the event; a later paid event could not resurrect the cancelled order and remained unconsumed;
5. dispute close-before-open failed without consuming its event;
6. after dispute open, the same earlier close event succeeded; repeated open and close deliveries remained idempotent;
7. a late provider dispute attached to the already-active return case instead of creating another active case.

All probes were rolled back.

**Result:** delayed/out-of-order event state-transition semantics are VERIFIED at code, deployed SQL and hosted PostgreSQL 17 boundaries. A deliberate Stripe-side replay of every adverse event sequence was not performed; that provider-delivery replay remains separate from this scoped proof.

## 3. Received / Accept / 48-hour Buyer Protection

### Deployed contract

`commerce_settings.auto_release_hours = 48` on the QA database.

The deployed `buyer_mark_order_item_received(uuid, boolean)` function:

- requires an authenticated actor and verifies buyer ownership;
- requires a paid order and receipt-ready fulfilment state;
- treats already-achieved Received/Accept states as idempotent no-ops;
- blocks receipt acceptance when any active transaction-case stage exists;
- refuses to reopen blocked/reversed payout states;
- preserves an in-flight release claim;
- first `Received` sets the delivery/receipt timestamps and schedules release at the existing deadline or exactly `auto_release_hours` later;
- explicit `Accept` makes a normal eligible payout immediately eligible without rewriting the first receipt timestamp.

The function is executable by `authenticated`, not anon/service role, and enforces ownership internally.

### Hosted PostgreSQL 17 rollback proof

On the historical completed QA order, the item was temporarily reset only inside a transaction, exercised, and rolled back. Assertions proved:

- first `Received` moved the synthetic in-transaction state to delivered/scheduled and created an exact 48-hour eligibility window;
- a later Received retry, including a NULL boolean input, preserved the original receipt/delivery/deadline timestamps;
- explicit Accept moved the item to accepted and made release eligibility immediate while preserving the original receipt timestamp;
- an active return case blocked explicit acceptance before any payout state could be reopened.

After `ROLLBACK`, the durable historical order was re-read as its original `paid/completed` order with `completed` fulfilment, `released` payout and the same historical Stripe transfer.

The earlier genuine provider E2E also proves the explicit Accept branch through UI → Supabase → real Stripe sandbox seller transfer.

**Result:** Received/Accept/48h state semantics and blockers are VERIFIED at deployed PostgreSQL and explicit-Accept provider boundaries. Natural passage of the full 48-hour window followed by automatic provider payout has not been artificially time-shifted and remains a separate elapsed-time/provider observation.

## Remaining separation of evidence

These results do not imply that every external release gate is complete. In particular, real alert destination receipt, physical Android/FCM, legal/support sign-off, destructive disposable-account deletion, and provider-side adverse event replay remain separate gates where applicable.
