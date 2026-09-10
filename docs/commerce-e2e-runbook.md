# SecondPart Commerce E2E Runbook

This runbook is the release gate for real Stripe test-mode commerce on `rebuild-nextjs`. Database status changes are never manually forced to make a scenario pass. Provider-facing transitions must happen through the same application / Stripe paths used by a real buyer and seller.

## Current preflight gate

Open `/admin/commerce/e2e` as an administrator. The preflight must show:

- at least one active listing;
- at least one Stripe Connect seller with `onboarding_status=complete`, `transfers_enabled=true` and `payouts_enabled=true`;
- no environment/configuration blocker preventing test checkout.

If payout-ready sellers is zero, do not simulate readiness by editing `seller_payment_accounts`. Complete a real Stripe **test-mode** seller onboarding instead.

## Scenario A — happy path, explicit buyer acceptance

1. Use a dedicated QA seller with completed Stripe test-mode Connect onboarding.
2. Publish a low-value QA listing through the normal seller workflow. Confirm it is checkout-ready in Admin > System readiness.
3. Sign in as a separate QA buyer. Buyer and seller must not be the same profile.
4. Start checkout through the normal web or Android flow and complete Stripe Checkout with a Stripe test payment method.
5. Return to SecondPart and record the real `orderId`.
6. Open `/admin/commerce/e2e?order=<orderId>`.
7. Confirm payment checks pass: checkout session exists, PaymentIntent/charge/paid timestamp are persisted, `payment_events.checkout_paid` exists, and the order audit contains `payment_confirmed`.
8. As the QA seller, move fulfilment through the normal UI and dispatch with a test shipment reference.
9. Re-open the verifier. Dispatch evidence must pass; payout must not be released merely because dispatch happened.
10. As the QA buyer, use **Accept item**. This is the explicit-acceptance happy path, so `release_eligible_at` may become immediate if no case/dispute exists.
11. Run the normal payout maintenance/release path. Do not call payout-state RPCs manually.
12. Re-open the verifier. The happy path is complete only when `payout_status=released`, `funds_released_at` is present and a real Stripe test `provider_transfer_id` is persisted.
13. Confirm the seller's Stripe test account shows the transfer and SecondPart's audit timeline contains `seller_transfer_released`.

The verifier must have `0 fail` and stage `completed` before this scenario can be signed off.

## Scenario B — Buyer Protection timer

Repeat with a fresh QA listing/order. After dispatch, buyer uses **Received** but does not use **Accept item**. Verify:

- fulfilment becomes delivered;
- `buyer_received_at` and `delivered_at` are present;
- payout becomes scheduled;
- `release_eligible_at` is approximately the configured Buyer Protection duration in the future;
- running payout maintenance before eligibility does not transfer funds;
- payout becomes releasable only after the protection window and only if no case exists.

Do not shorten production policy values merely to make the release test pass unless a separate QA environment/config is deliberately used and documented.

## Scenario C — silent buyer / unverified delivery

With a fresh shipping order, dispatch normally and leave the buyer silent. Verify that silence alone does not schedule or release payout. The production policy is:

- after the configured unverified-delivery age (default 14 days from dispatch), the item enters the admin payout-review queue;
- admin evidence approval starts the normal Buyer Protection window;
- approval is not an immediate payout;
- a case opened before release blocks payout.

This long-duration policy should be verified with controlled QA fixtures or a dedicated test environment, not by falsifying a real production dispatch timestamp.

## Scenario D — buyer cancellation before dispatch

Create and pay a fresh test order, then use the normal cancellation request / admin or seller resolution path allowed by the product. Verify:

- stock/listing state is restored according to the controlled cancellation/refund flow;
- provider refund is persisted when money was captured;
- payout is never released for the cancelled item;
- repeated webhook/reconciliation calls do not duplicate the refund or corrupt stock.

## Scenario E — return / transaction case

Create a fresh paid/fulfilled test order and open a return/dispute case through the buyer UI. Verify:

- the case appears in Admin > Commerce;
- payout becomes or remains blocked while the case is active;
- seller response and case audit are retained;
- authorised return / returned state follows the normal flow;
- refund finalisation stores the provider refund ID;
- if a seller transfer had already occurred, any required transfer reversal is recorded.

## Scenario F — Stripe payment dispute and payout reversal

Use Stripe test-mode dispute tooling/events against a disposable QA transaction. Verify:

- `charge.dispute.created` creates/links a provider dispute case;
- payout release is blocked while the provider dispute is active;
- if a transfer was already released, SecondPart enters the controlled reversal path rather than silently changing `payout_status`;
- closing the Stripe dispute is idempotent and records the final provider status/reversal evidence.

## Scenario G — competing checkout / last stock

Use a QA listing with stock `1` and two separate buyer accounts/sessions. Attempt checkout concurrently.

Expected result:

- exactly one reservation wins;
- the second attempt receives a controlled stock/reservation conflict;
- no negative stock is possible;
- an expired/cancelled winning reservation restores availability once;
- repeated cancel/expiry/webhook delivery remains idempotent.

## Webhook idempotency gate

For all payment scenarios, Stripe events may be delivered more than once. A release candidate is not complete until duplicate `checkout.session.completed`, expiry/failure and dispute events leave one coherent database result with no duplicate money movement.

## Evidence to retain for release sign-off

For each scenario retain:

- order ID and order item ID;
- QA timestamp;
- tester/device surface (web or Android RC);
- verifier screenshot or copied PASS/PENDING/FAIL summary;
- Stripe test object IDs visible in the normal provider dashboard/logs;
- final result and any defect/commit used to resolve it.

Do not retain test card data, secrets, full shipping addresses or other unnecessary personal data in release notes.
