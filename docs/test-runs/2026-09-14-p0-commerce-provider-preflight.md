# P0 Commerce provider preflight — 2026-09-14

Branch: `rebuild-nextjs`

Purpose: refresh the shortest legitimate route from the now-verified Refund Authority + Idempotency code boundary into real Stripe sandbox evidence, without mutating the historical happy-path fixture or inventing compatibility.

## Verified application boundary

- Refund/reversal code boundary: `a8b6bc0d00c8f4579f0be2808c04a47e805bb03a`
- GitHub Actions run `34871738812`: validate PASS, full tests PASS, all release validators PASS, production build PASS
- last-stock two-connection PostgreSQL job: PASS
- marketplace-scale PostgreSQL job: PASS
- exact-SHA Vercel Preview `dpl_8td6dKCxLvPYergmUsdpPe1A8SKY`: READY
- Stripe context used for read-only checks: platform sandbox `acct_1UEUN72RWsyIBCbK`, `livemode=false`

## Historical transaction preserved

The known successful commerce fixture remains untouched:

- order `d53fc4eb-9830-4956-8e6f-2ced3ea37a72`
- PaymentIntent `pi_3UEaav2RWsyIBCbK1Z4TppDc`
- transfer `tr_3UEaav2RWsyIBCbK1ZxP18jl`

Fresh read-only checks after the hardening show:

- Stripe refunds for that PaymentIntent: 0
- order: paid / completed
- item: completed
- payout: released
- no transfer reversal
- no refund timestamp
- no transaction case

Do not reuse this historical happy-path object for destructive adverse-flow QA.

## Current hosted listing readiness

Fresh QA RPC readback:

- active listings: 6
- checkout-ready active listings: 0
- checkout-blocked active listings: 6

A payout-ready seller now has a draft listing that passes the application-level publication prerequisites in read-only checks:

- stock: 1
- title length: valid
- description length: valid
- category: selectable
- real product photo count: 1
- donor vehicle: present and owned by the same seller
- compatibility evidence: present through that owned donor
- Stripe Connect payout readiness: true
- current marketplace Terms / Privacy acknowledgement: true

The current seller form exposes explicit `Save draft` and `Publish listing` actions. The draft therefore no longer needs invented OE/OEM or catalogue fitment data merely to become publishable.

## Remaining blocker before provider mutation

The technically ready draft has **not** been designated as a disposable adverse-flow QA fixture in this checkpoint. Publishing it and then buying/refunding/reversing it would mutate existing QA seller inventory and payment state.

Therefore the next provider-level action remains gated on using a deliberately disposable listing through the authenticated normal Seller UI. Do not publish the draft directly through SQL or fabricate compatibility merely to make the preflight counter turn green.

## Shortest legitimate provider-E2E sequence

1. Use a deliberately disposable QA seller listing that already has truthful fitment evidence, real test photo, stock 1 and payout-ready seller ownership.
2. Publish through the normal Seller Dashboard `Publish listing` action.
3. Confirm `/admin/commerce/e2e` reports at least one checkout-ready listing and Stripe mode `test`.
4. Complete a new buyer checkout in Stripe test mode.
5. Create the intended adverse case through the normal application path.
6. Execute the application refund path; if payout has already been released, require the application reversal path first.
7. Cross-check UI, Stripe and Supabase for exact PaymentIntent/refund/reversal IDs and exact amounts.
8. Reload/retry the same operation and prove Stripe object counts do not increase.
9. Retain the historical successful fixture unchanged.

This is the remaining provider proof. Code-level Refund Authority + Idempotency is already verified separately in `docs/test-runs/2026-09-14-refund-authority-idempotency.md`.
