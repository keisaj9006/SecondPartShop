# SecondPart — Product Decisions

This file contains current product direction derived from the latest project work and explicit user decisions.

Where current repo behaviour differs, inspect `docs/DECISION_CONFLICTS.md` and do not silently overwrite working systems.

## LOCKED / CURRENT

### Branch
- Active development is `rebuild-nextjs`.
- Do not modify `main`.

### Market
- Initial market: United Kingdom.

### Core proposition
- SecondPart is a used/recycled automotive-parts marketplace with vehicle-first compatibility.
- Correct fit and trust are more important than raw listing count or cheapest price.

### Public browsing
- Marketplace discovery should be available publicly.
- Authentication is required for protected writes/account-specific actions as appropriate.

### Buyer and seller account modes
- Buyer and Seller modes should be explicit.
- A seller must still be able to buy.
- Seller functionality must not remove buyer capability.

### Vehicle context
- Garage is persistent vehicle context.
- Buyer must be able to add/select a new vehicle without being forced into an old preselected vehicle.
- Home and Garage vehicle-selection semantics should remain consistent.

### Compatibility filter
- Expose `Show only parts that fit this vehicle` or equivalent clear control.
- When enabled, do not include inventory lacking sufficient compatibility evidence.
- When disabled, broader inventory can be shown.
- Do not present family-level/model-level similarity as exact confirmed fit.
- Server-side checkout/purchase rules must not be bypassable merely by changing UI state.

### Vehicle lookup
- Provider failure must degrade safely to manual vehicle selection.
- Never fabricate registration results.
- The provider layer should remain replaceable/enrichable.

### Reviews
- Reviews must be linked to real completed transactions.
- Preserve separate buyer/seller reputation concepts where implemented.

### Verified Fit
- Verified Fit is a transaction-derived signal.
- It should be based on completed purchase + sufficiently identified buyer vehicle + fit outcome.
- Sellers cannot self-award it.

### Seller trust
- Seller verification and operational reputation matter.
- Verified state must remain protected at application/database level.

### Images
- Preserve image type/signature/size validation.
- Preserve client compression where already implemented.
- Do not weaken media-security rules to make uploads easier.

### Payments
- Use regulated marketplace payment-provider architecture.
- Do not create a fake wallet or DIY regulated escrow.
- Preserve provider/webhook authority for payment state.
- Preserve buyer protection and auditable state transitions.
- Preserve conservative payout-release policy.

### Inventory
- Used parts are often quantity-one.
- Oversell protection is a P0 concern.
- Bulk import and future synchronization are strategic.
- Large sellers should not need to manually list tens of thousands of items.

### Android/mobile
- Preserve current production Android architecture unless a specific defect justifies change.
- Mobile must expose the same core marketplace logic as web.
- Release readiness requires physical-device evidence, not only successful build.

### Launch
- Do not scale paid buyer acquisition before marketplace liquidity and transaction QA are proven.

## CURRENT STRATEGIC TARGETS

### Find My Part
Treat Find My Part as a core zero-result / low-confidence recovery system and eventually as part of the search engine.

Direction:
- prefill vehicle and search intent,
- target relevant sellers,
- keep buyer contact protected,
- normalize quotes,
- learn from seller responses.

### Professional supply first
Prioritize professional recyclers/breakers/ATFs/garages and repeat inventory during liquidity build.

Private sellers may remain supported where already implemented, but they should not dominate launch engineering or seller-acquisition strategy.

### Founding Seller / Recycler proposition
The strongest early seller proposition is operational:
- easy migration/import,
- low/no early fees,
- seller demand,
- no duplicate listing work,
- useful response analytics.

### Compatibility transparency
Prefer:
- "fits because..."
over:
- opaque green "fits" badge.

### Category-specific attributes
High-risk categories may require category-specific fitment/listing fields.

Especially:
- engines,
- transmissions,
- headlamps,
- mirrors,
- electronic modules,
- body/side-specific parts.

## RESEARCH TARGET — NOT AUTOMATICALLY LOCKED

The following are research-backed directions requiring deliberate adoption:
- explicit FitmentEvidence-style domain layer if current model does not already represent it sufficiently,
- wave-based Find My Part seller distribution,
- donor-stock matching as a first-class supply mode,
- eBay/feed synchronization,
- stronger professional-only beta emphasis,
- category-specific compatibility schemas,
- "why it fits" UI as a first-class product surface,
- B2B garage procurement expansion.

Codex must inspect existing architecture and propose migration-safe changes before implementing these.
