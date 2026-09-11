# Commerce Preview E2E — Scenario A evidence, 11 September 2026

Scenario A (test purchase, fulfilment, explicit buyer acceptance and Connect transfer) passed. This is not an overall commerce or launch sign-off. Earlier sections preserve the chronological preflight and resolved blockers; the final section records the completed transaction.

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

Follow-up verification: Charge API confirmed amount/amount_captured 1250, currency gbp, paid true, succeeded, livemode false and matching order metadata/transfer_group. A Stripe API list filtered to this order's transfer_group returned data [] and has_more false before fulfilment. Purchase-display fix committed/pushed as `316dbaa67d224912832ed6165d762644ed3de3cd`; local lint/typecheck/build and targeted validators passed; CI `34642419154` succeeded. Preview `dpl_BHitjzpiFV58aKaDFJAhy8qcHRbC` READY, URL `second-part-shop-41gwdd7gb-joannakwapis11-5369.vercel.app`; stable alias updated to it. Browser reload now shows the paid item, correct seller, Preparing status and cancellation/problem controls. Seller login handoff opened on the branch Preview alias while preserving Buyer on the stable alias for later receipt/acceptance.

## Scenario A: fulfilment, explicit acceptance and transfer — PASS

Executed on code commit `316dbaa67d224912832ed6165d762644ed3de3cd`, READY Preview `dpl_BHitjzpiFV58aKaDFJAhy8qcHRbC`. Stable and branch aliases were verified against that deployment before execution. QA Seller used the branch alias and the distinct QA Buyer used the stable alias. Moira was not edited.

| Event (UTC, 11 September) | Database/provider evidence |
| --- | --- |
| 20:16:53 seller dispatch | Normal seller form, synthetic carrier/reference. Item dispatched; payout not_ready; transfer null. Stripe order-group list empty. |
| 20:17:41 buyer receipt | Normal buyer button. Item delivered; payout scheduled; accepted_at null; eligibility 13 September 20:17:41 UTC (48 hours); no transfer. |
| 20:19:16 explicit acceptance | Buyer selected Accept item & complete and confirmed Yes, accept & complete. Stripe Dashboard context immediately before this flow reported livemode false. |
| 20:19:18 transfer finalized | Order completed/paid; item completed/released. `tr_3UEaav2RWsyIBCbK1ZxP18jl` recorded with funds_released_at. |
| 20:21:50 paid webhook resend | Official Stripe Shell resent `evt_1UEaax2RWsyIBCbK5imexkww` to `we_1UEa0q2RWsyIBCbKwy45jivt`. Dashboard delivery was Delivered, HTTP 200. Original delivery at 19:58:49 was also HTTP 200. |

Stripe API retrieved the actual transfer: amount 1250, currency gbp, livemode false, destination `acct_1UEUQn2RWspvWMnK`, reversed false; metadata order_id `d53fc4eb-9830-4956-8e6f-2ced3ea37a72`, order_item_id `24fcf358-dba3-4278-9740-79eaa89f0681`, payout_attempt initial, transfer_group `order_d53fc4eb-9830-4956-8e6f-2ced3ea37a72`. The order's fee snapshot was 0 and seller net 1250; no fee was overridden for the test.

After webhook resend and refresh of both Buyer and Seller pages, the API list for this transfer_group contained exactly one element (the same transfer), has_more false. Supabase retained exactly one payment event and one seller_transfer_released event. Buyer UI showed Paid / Completed and its purchased item; Seller UI showed Completed / Paid / Released and the correct net amount. No duplicate action button remains in completed UI.

The repeated release-function invocation and lost-provider-response retry were additionally exercised by executable isolated tests of the real payout worker, with database/provider boundaries replaced by fixtures. They prove that already-released items avoid another provider call and a retry recovers the existing transfer. These do not induce a provider outage or repeat the completed buyer-acceptance form in Preview. The real webhook resend, page refreshes and subsequent authenticated payout-endpoint repetitions (below) were tested in Preview.

The listing remains a retained, clearly marked QA fixture: part `421960b0-613d-41fd-9bf3-a5e0e65a3044`, status sold, stock 0. It is no longer active/available for checkout. No SQL writes, fabricated fulfilment timestamps, readiness overrides, Live payments, onboarding reruns or Moira-profile changes were used. Shipment, receipt and acceptance are synthetic QA actions, not claims of physical delivery. No review or Verified Fit was granted.

A further small UI defect from listing creation was reproduced: native form reset cleared selected files but left the ready-photo message. An executable regression test failed before the fix; the image input now clears feedback on form reset without weakening upload validation. Four payout-worker tests cover repeat invocation, future eligibility, lost response recovery and active-case blocking. These tests are included in branch CI.

Remaining release batches: cancellation/return/refund/dispute/reversal, stock-one competing checkout, declined-payment retry, provider outage/recovery, Android/device QA, release configuration, legal and liquidity gates. Preview CRON_SECRET was subsequently configured for the authenticated endpoint repetitions below; scheduled execution cadence remains a separate operations check. Explicit acceptance used the normal immediate payout worker successfully.

Final local verification for the follow-up patch: 20 executable tests passed; all 14 static validators passed; git diff --check, lint (0 errors, 3 pre-existing legacy warnings), typecheck and production build passed. Build used non-secret CI placeholder public configuration. Public Buyer navigation to the sold fixture returned 404 with no checkout button; its authorized purchase detail remained available.

## Follow-up: deployed regression and authenticated endpoint repetitions — PASS

- Commits `5f2145f` (image reset and executable retry coverage) and `ea79777fb2347fd6b92aedd8d01b191093639266` (evidence) pushed only to rebuild-nextjs. CI `34644906776` completed successfully. Independent read-only code review found no introduced defect.
- Browser regression on the branch Preview: selected the QA PNG, observed 1 photo ready to upload, submitted a deliberately incomplete active listing through the normal form. Required identity/fitment validation rejected it; the photo-ready message correctly disappeared. Supabase confirmed zero rows for that attempted fixture title. No additional listing was published.
- Configured a newly generated CRON_SECRET as Vercel sensitive, target preview, gitBranch rebuild-nextjs. No other environment values were changed or printed. Local temporary copy deleted after requests.
- Redeployed the same SHA with that configuration: `dpl_51XUPgYrv4sYLm2TGnaKvvbyVqf3`, READY Preview, `second-part-shop-gn9qo3x07-joannakwapis11-5369.vercel.app`. Both stable and branch aliases pointed to it after SHA verification.
- Before the endpoint test, database scope was exactly two QA order items: this released purchase and the earlier cancelled checkout with not_ready payout. Neither had pending rollback; there were no unrelated eligible items. Stripe context returned livemode false before each authorized invocation.
- Actual GET `/api/commerce/release-due` without authorization returned 401. Two authorized calls returned 200 / ok true, each with checked, released, deferred, releasingChecked, recoveredReleasing, reconciliationDeferred, rollbackChecked, rollbacksCompleted and rollbacksDeferred all zero. The released item was not selected for another payout.
- Final Stripe API list after both calls still contained exactly one transfer, `tr_3UEaav2RWsyIBCbK1ZxP18jl`, 1250 gbp, livemode false, destination `acct_1UEUQn2RWspvWMnK`, has_more false. Supabase retained completed/released, the same funds_released_at, one payment event and one release event.

Scenario A and duplicate-delivery/refresh/payout-endpoint checks are complete. This is a Connect marketplace transfer test, not an external bank-settlement test. No overall launch, refund/reversal, concurrency or device gate is implied.
