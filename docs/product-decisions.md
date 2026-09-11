# SecondPart — Product Decisions

## Current payment and Buyer Protection decisions

Status: implemented and happy-path verified in Preview at `72f9fdc` on 11 September 2026. See [the provider evidence](test-runs/2026-09-11-commerce-preview-preflight.md) and [current release rules](launch-readiness.md#buyer-protection--silent-buyer--unverified-delivery-policy).

Stripe is authoritative for payment state. Checkout reservations and paid-confirmation guards remain in force. Seller transfers are separate from the buyer charge and require the approved Buyer Protection release conditions. Explicit buyer acceptance may make a paid, case-free item eligible; confirmed receipt starts the configured protection window. Without confirmed receipt or trusted delivery evidence, silence alone never releases funds. Reviewed unverified-delivery escalation and local-collection restrictions follow the canonical commerce runbooks.

Refund, return, dispute, reversal and failed-payment/retry E2E evidence remains a separate release gate. The successful test purchase does not authorize Stripe Live, Production release, repeat onboarding or a payment architecture redesign.

The project does not operate a user wallet and must not describe the current flow as legally regulated escrow. Preserve provider authority, transaction history and idempotency.

## Historical pre-implementation payment proposal — superseded

The following records the earlier proposal for provenance. Its deferred-build timing and unspecified automatic-release rule are not current implementation instructions; the decisions above and the canonical runbooks supersede them.

**Historical status:** Product decision recorded before commerce implementation.

SecondPart should use a buyer-protection payment flow similar in principle to marketplace escrow-style models:

1. The buyer pays for the item.
2. Funds are held by the platform/payment provider and are not immediately released to the seller.
3. The seller dispatches or hands over the item.
4. After the buyer receives the item, the buyer confirms that the order is acceptable.
5. Only after confirmation — or after a defined automatic-release period if no issue is reported — are funds released to the seller.
6. If the item is not delivered within the allowed period, the transaction can be cancelled and the buyer is refunded.
7. If the item is materially faulty, damaged, not as described, or otherwise qualifies for return under the platform rules, the buyer can open an issue/return flow.
8. Where a return is approved, funds remain protected during the return process and are refunded to the buyer after the return conditions are satisfied.
9. Exact release windows, dispute evidence, return shipping responsibility, exceptions, and payment-provider mechanics must be defined before implementation.

### Important implementation principle

Do not build a fake in-app wallet or hold regulated client money directly in application code. When payments are implemented, use a regulated marketplace payment provider that supports delayed capture / separate charges and transfers / marketplace payouts or an equivalent compliant flow for the UK.

### Build timing

Payments, payouts, disputes, refunds, and settlement are a **final commerce layer**. Finish the core buyer/seller marketplace workflows first, then design and implement this flow with the payment provider.

## Vehicle identification strategy

**Status:** Provider-gated vehicle identification strategy. DVSA activation remains explicitly blocked pending official access; manual selection stays available.

SecondPart should not depend on a paid VRM lookup for its core buyer flow while the marketplace is pre-revenue.

Primary flow:

1. **DVSA MOT History API** — official registration lookup when approved credentials are configured.
2. **SecondPart DfT vehicle catalogue** — map the DVSA make/model/year/fuel/engine data into the internal catalogue.
3. If the match resolves to one exact catalogue variant, apply it automatically.
4. If several valid derivatives remain, show only the remaining exact-version choice.
5. If the official lookup cannot resolve the vehicle, fall back to the existing manual Make → Model → Year → Version → Engine flow.
6. **Vehicle Data Global (VDG)** remains an optional paid fallback / enrichment provider for a later stage, not a required dependency.

Current VDG sandbox package `VehicleDetails` contains both `ModelDetails` and `VehicleDetails`, so it is suitable for later enrichment if the free/official route proves insufficient. Do not purchase or enable paid production lookups without explicit approval.

Registration results must never be fabricated. Provider failure must degrade to manual selection.
