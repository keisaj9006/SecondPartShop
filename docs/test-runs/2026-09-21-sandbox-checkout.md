# Sandbox checkout verification — 21 September 2026

Scope: hosted Preview, Stripe account acct_1UEUN72RWsyIBCbK, livemode=false. No real-money payment.

- User explicitly authorized administrator role for existing QA buyer account; access to the E2E verifier confirmed.
- Existing QA seller listing 127410a0-e9c0-421d-8a05-68160100d9b7 reused through normal seller editor, marked NOT FOR REAL SALE, GBP 5.00, stock 1. Existing donor and photo retained without new fitment claims.
- Preflight before checkout: test mode, signing configured, one checkout-ready listing, one payout-ready seller, payout recovery ready.
- First order cfd3b7e1-6fda-4176-8d55-423fe5995ce2 expired unpaid. Stripe confirmed expired/unpaid; application cancelled order and restored active stock 1.
- Second order: 2766715b-3d07-4f66-be8e-75ae1650875f.
- Item: c031a1d4-2896-4bfd-b3b8-f8a6c758fb38.
- Session: cs_test_a1C40U0NW7FScdAgYrAh8Qc0BriKN6aR1R3i3724qunT5KgGgoTbn1PtP2.
- User submitted the test card payment after automated browser approval rejected agent submission. No alternate payment submission path was used.
- Stripe session readback: complete, paid, livemode=false, amount_total=500.
- PaymentIntent: pi_3UI6AA2RWsyIBCbK1r44MsX4.
- Charge: ch_3UI6AA2RWsyIBCbK1E9rygyY.
- Paid timestamp: 2026-09-21T12:17:41.16725Z.
- Supabase: order/payment paid, checkout_paid and payment_confirmed audit evidence, item preparing / payout not_ready, collection, no transfer or released timestamp.
- Inventory: sold, stock 0.
- UI verifier: 9 pass, 4 pending, 0 fail, stage Fulfilment.

Next: QA seller marks ready for collection through normal workflow, then QA buyer acceptance and payout verification. Refund/dispute/recovery/replay remain unverified for this fresh order. Global preflight now shows zero checkout-ready listings because the single test unit was purchased; this does not invalidate the paid-order checks.

## Seller fulfilment verification

Normal seller UI action Ready for collection succeeded on 21 September 2026 at 12:33 (UI timestamp). Timeline records preparing -> ready for collection. Independent database readback confirms fulfilment_status=ready_for_collection, payout_status=not_ready, funds_released_at=null, provider_transfer_id=null. Seller readiness alone has not released money. Awaiting QA buyer receipt / acceptance through the normal buyer workflow.

## Buyer receipt verification

Normal buyer action I received it succeeded (timeline 21 September 2026, 13:10). UI shows Delivered and buyer-protection review window, with Accept item & complete still available. Final acceptance makes seller transfer eligible immediately; left for user action under browser financial-action handoff rules. UI also claims eligibility after 23 September 2026, 14:10 without a case; this copy/behaviour needs comparison with the explicit-acceptance product rule before launch.

## Buyer acceptance and provider transfer verified

User performed Accept item & complete. Audit records buyer acceptance at 2026-09-21T13:15:47 and seller transfer released at 2026-09-21T13:15:51.099325Z. Database readback: fulfilment_status=completed, payout_status=released.

Independent Stripe sandbox GET confirms transfer tr_3UI6AA2RWsyIBCbK1uG7sJSn: amount=500, currency=gbp, livemode=false, destination=acct_1UEUQn2RWspvWMnK, source_transaction=ch_3UI6AA2RWsyIBCbK1E9rygyY. Metadata matches this exact order and item; payout_attempt=initial. amount_reversed=0, reversed=false, no reversals. This proves a Connect transfer to the seller Stripe account, not a bank payout.

Hosted E2E verifier: Completed, 13 pass / 0 pending / 0 fail. Happy-path sandbox checkout, collection, explicit buyer acceptance and Connect transfer are verified. Preflight for a NEW purchase still shows no checkout-ready listing because the fixture stock was consumed. Fresh refund, dispute, reversal recovery and webhook replay remain separate unverified gates.

## Return case workflow (partial)

Buyer opened a clearly labelled sandbox return for the current item via normal UI; Admin Commerce displayed case 896B3B6F. Admin authorised the simulated return. Buyer recorded carrier QA SIMULATION - NO CARRIER and reference QA-NO-SHIPMENT-2766715B; UI now shows Return Shipped. No real shipment, customer allegation or physical evidence was fabricated. Seller receipt/response requires the separate seller session; final refund/reversal remains unexecuted. Do not count this as a complete Scenario E pass.

Policy clarification: the review-window copy after explicit buyer receipt agrees with docs/launch-readiness.md. The prohibited silent-buyer release is the absence of buyer receipt or trusted delivery; no product-policy defect was established by the earlier UI observation.
