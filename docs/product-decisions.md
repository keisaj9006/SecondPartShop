# SecondPart — Product Decisions

## Payment protection / escrow-style buyer protection

**Status:** Product decision recorded; implementation intentionally deferred until the end of the marketplace build.

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

**Status:** Canonical pre-payments strategy.

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
