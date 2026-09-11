# Commerce Preview E2E — blocked preflight, 11 September 2026

This is not a completed provider E2E or launch sign-off.

## Verified environment

- Repository: `keisaj9006/SecondPartShop`, branch `rebuild-nextjs`.
- Local HEAD and freshly fetched origin: `221e5695c3efb758a413d1f6e7f7506c9cba4a13`.
- Stable alias: `second-part-shop-preview.vercel.app`.
- Alias target: `dpl_6Bwm6MqfKHW1BcEzbcC4rxwE6ZgB`, READY, Preview (`target: null`), matching branch and SHA.
- Deployment URL: `second-part-shop-iziv139gl-joannakwapis11-5369.vercel.app`.
- GitHub CI run `34633950904`: completed/success for that SHA.
- Supabase project: `etkupijfdznljimrfyct`.

## Read-only preflight findings

- QA Seller `58ecccc3-5162-4826-9c3f-81dbd92a6007`: Connect `acct_1UEUQn2RWspvWMnK`, onboarding `complete`, transfers and payouts enabled.
- Earlier provider diagnostic on this same deployment reported `livemode: false`, recipient transfers active and payouts active. No new Stripe operation was made during this preflight; recheck test mode before subsequent provider operations.
- QA Seller has no listings. Aggregate RPC reports six active listings, zero checkout-ready listings. Orders count is zero.
- Existing profile labelled QA Buyer owns the excluded Moira seller. Identity clarification requested before using it.
- Both current Preview project configuration and deployment environment names omit `STRIPE_WEBHOOK_SECRET` and `CRON_SECRET`. Values were not printed.
- Missing webhook signing secret blocks the existing commerce preflight and payment configuration; the webhook verifier fails closed. An authenticated Stripe sandbox session was requested to configure the test webhook.
- Cron configuration is absent; the existing admin-only `runDuePayoutMaintenance` action provides a normal payout execution path if the appropriate admin session is available. No payout gate should be bypassed.

## Execution status and next batch

No Checkout Session, PaymentIntent, Charge, order or Transfer was created. No provider replay or duplicate-transfer claim has been proven. No SQL mutation, onboarding, live operation or alias change was performed.

Resolve buyer identity and sandbox access; configure the test webhook; prepare a clearly marked QA Seller test listing through the application; verify the resulting Preview configuration and matching commit. Then execute runbook Scenario A with explicit acceptance and provider/database evidence before and after release, followed by duplicate-delivery and retry checks. Do not mark other runbook scenarios complete from this result.

Fresh checks: `git diff --check`, eight Stripe Connect regression tests, commerce E2E harness, checkout expiry race, payout recovery, monitoring and seller read-policy validators passed. These validators inspect invariants and do not substitute for provider E2E.

Fresh lint and typecheck exited zero. Lint retains three pre-existing unused-variable warnings in legacy mobile-shell files. Local build exited zero using non-secret CI placeholder configuration, without deploying. No application fix was made or committed; this evidence and the earlier audit remain local untracked documents while provider QA is blocked.

## Follow-up: webhook configuration and delivery verified

The webhook-configuration blocker above was resolved later in this session; purchase E2E remains pending.

- User signed into Stripe. The initially opened Live dashboard was switched to `SecondPart sandbox` without Live configuration or payment operations.
- Stripe Dashboard context tool explicitly returned sandbox account `acct_1UEUN72RWsyIBCbK` and `livemode: false` before webhook creation and test-event/replay work.
- Created `we_1UEa0q2RWsyIBCbKwy45jivt`, named `SecondPart Preview commerce`, targeting `https://second-part-shop-preview.vercel.app/api/stripe/webhook`.
- Scope: platform account; snapshot payload; API version `2026-08-26.dahlia` (current stable option in Dashboard).
- Seven subscribed events match existing handlers: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.dispute.created`, `charge.dispute.closed`.
- Signing secret saved without printing its value as Vercel `STRIPE_WEBHOOK_SECRET`, type `sensitive`, target only `preview`. API metadata confirmed the scope.
- Redeployed unchanged HEAD `221e5695c3efb758a413d1f6e7f7506c9cba4a13`: `dpl_73bgPCqqpUigryA484q4naKqAdAy`, READY, Preview, URL `second-part-shop-id7grx5tj-joannakwapis11-5369.vercel.app`.
- Build/typecheck passed. Its provider diagnostic at 19:26:03 UTC again confirmed QA Seller account `acct_1UEUQn2RWspvWMnK`, `livemode: false`, transfers active and payouts active.
- Stable and rebuild-nextjs branch aliases both verified pointing to this deployment. CI run `34633950904` remains successful for the unchanged SHA.
- Used official sandbox Stripe Shell `stripe trigger checkout.session.completed` for a transport/signature smoke test. This creates a Stripe CLI sample fixture, not a SecondPart purchase.
- Sample event `evt_1UEa8P2RWsyIBCbKHtLZET44`; session `cs_test_a13vkvvnT0QTo2xVsigCw6BpFwI9ihV1tmFprATFlUvx6HhpMWitCNxf9Z`; PaymentIntent `pi_3UEa8O2RWsyIBCbK0JI3FNhF`. Session: complete/paid, 3000 USD minor units, empty order metadata, `livemode: false`; event also `livemode: false`.
- Stripe delivery at 19:29:18 UTC and resend at 19:31:32 UTC both returned HTTP 200 with `received: true`.
- Supabase after the smoke/replay: zero orders and zero payment_events. The unlinked fixture was correctly ignored by order processing. This does **not** prove order-payment processing or duplicate-transfer prevention.
- QA Seller session remains usable, but there are still zero seller listings. Publishing requires a real part photo and accurate listing facts. No invented photo/fitment or database state override was introduced.
- Buyer identity remains unresolved: the previously named QA Buyer owns Moira, which the user excluded. Another buyer-role profile exists but has not been approved/identified as the dedicated QA account.

No actual SecondPart purchase, fulfilment, seller transfer or payout was performed. No overall commerce release gate is marked passed.

## Follow-up: approved synthetic listing published

- User explicitly approved using the existing QA Buyer only as buyer and a synthetic, clearly labelled listing/image fixture. Moira must remain unchanged.
- Buyer user `3bc91c3f-4a15-4813-83c5-54bc94b9e36f` and seller owner `cf2ef681-9ced-4fb8-9a50-efd5668138b0` are distinct, verified by read-only seller ownership query.
- Generated deterministic `fixtures/qa-test-part.png` with visible QA TEST PART / NOT FOR SALE labels. Uploaded through the normal listing file chooser.
- Publication correctly rejected missing identity/fitment evidence. Added explicitly synthetic part number `QA-FOCUS-MK3-ALT-001` and brand `Synthetic QA fixture`; no OEM or exact-fit assertion was invented.
- Validation resets native file selection; the UI still showed a ready-photo count. Re-selecting the file through the normal chooser allowed publication. This form-state discrepancy is recorded for investigation, not considered fixed.
- Published via seller form: part `421960b0-613d-41fd-9bf3-a5e0e65a3044`, slug `qa-test-ford-focus-mk3-alternator-04da4668`, seller `58ecccc3-5162-4826-9c3f-81dbd92a6007`, active, Used, stock 1, price 1250 GBP minor units, shipping 0. Confirmed in Supabase and seller dashboard.
- Signed out seller and verified the public listing renders anonymously with correct title, price, seller and synthetic description/image. No explicit fitments or Verified Fit reports were added.
- Opened Sign in to buy with return URL to this listing; awaiting user login as QA Buyer. No checkout/order/transfer has yet been created for this listing.
- Fresh origin fetch and deployment inspection still match HEAD `221e5695c3efb758a413d1f6e7f7506c9cba4a13`, READY Preview `dpl_73bgPCqqpUigryA484q4naKqAdAy`.

## First application checkout: provider rejection and recovery

QA Buyer signed in correctly and used Buy now on the fixture. Order `07ca58ad-06b1-4f3f-80db-9624f9af8b5e` has buyer `3bc91c3f-4a15-4813-83c5-54bc94b9e36f`, total 1250 GBP minor units. Stripe rejected setup before returning a session: `Invalid Stripe API version: 2026-08-26.clover` (Preview runtime log, 19:48:15 UTC). Application cancellation marked order/payment cancelled with no provider session and released reserved stock.

Root cause is the invalid V1 version constant in `stripe-payments.ts`, not Connect readiness or buyer/seller roles. Updated the default to the sandbox's current stable `2026-08-26.dahlia`; environment override remains supported. Regression test reproduced the old header failure before the change, then all 11 adapter tests passed. Tests also verify amount/currency/order metadata/idempotency headers and propagation of provider errors. No payment or transfer was fabricated.

## Paid application order and purchase-display regression

- API-version fix committed as `26fc9eab808e042f1cb9dd0c4372d4f3b0bddf80`; CI `34641229688` successful; Preview `dpl_A1jKnXS9jycQNeB1qn2XxHfMPbRi` READY and stable alias updated after verifying SHA.
- Retried through Buy now as QA Buyer. New order `d53fc4eb-9830-4956-8e6f-2ced3ea37a72`; item `24fcf358-dba3-4278-9740-79eaa89f0681`; session `cs_test_a1JHj8F4OWCvzDoPalO6DMQRK7l3ji3HugixfSFAseSgE2tik0C7RrVzsb`.
- Stripe Shell API retrieval before payment confirmed open/unpaid session, `livemode: false`, amount 1250 GBP minor units and matching order reference/metadata. Used only official Stripe test card and synthetic shipping data; did not save payment details.
- PaymentIntent `pi_3UEaav2RWsyIBCbK1Z4TppDc`, Charge `ch_3UEaav2RWsyIBCbK1FKEaP7I`; webhook `evt_1UEaax2RWsyIBCbK5imexkww` persisted as `checkout_paid`.
- Supabase at 19:58:48 UTC: order/payment paid, item preparing, payout not_ready, no transfer. Fee snapshot 0; seller net 1250. Part sold, stock 0.
- PaymentIntent API retrieval confirmed succeeded, amount_received 1250, currency gbp, livemode false and matching order metadata/transfer_group.
- Buyer UI displayed payment confirmation but omitted the purchased item. Root cause: sold part is correctly hidden by public parts RLS; buyer-order mapper discarded items when embedded part was null.
- Fix retains RLS and buyer_id filtering. Only after the authorized order query, missing part identities are retrieved server-side using IDs from its readable order items, selecting only id/title/slug. Both purchase list and detail paths are covered. Inaccessible orders trigger no privileged lookup.
- Regression tests reproduced two missing-item failures before the fix; all 15 tests passed after it. Full fulfilment/acceptance/transfer remains pending.
