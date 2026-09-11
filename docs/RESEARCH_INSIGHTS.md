# SecondPart — Deep Research Insights

Research date: 11 September 2026.

This document translates research into product implications.

It is not a command to rewrite existing systems.

## Executive interpretation

Strongest thesis:

> SecondPart should be a vehicle-first procurement system for recycled parts, not another generic used-parts marketplace.

The research identifies four areas competitors often fragment:
- fitment confidence,
- inventory discovery,
- transaction protection,
- seller operations.

This aligns well with SecondPart's current direction.

## Highest-value research findings

### 1. Compatibility must be evidence-based

Research recommends moving away from opaque binary fit/no-fit thinking.

Useful confidence sources:
- exact OE/OEM number,
- donor match,
- trusted catalog relation,
- seller confirmation,
- previous verified successful fit.

**Impact on SecondPart: HIGH**

Action:
- audit current compatibility model,
- identify missing evidence/provenance concepts,
- improve explanation without breaking working fitment logic.

Status: ADOPT DIRECTION / IMPLEMENT INCREMENTALLY.

### 2. "Why this fits" is a differentiator

Research recommends exposing evidence behind compatibility.

**Impact: HIGH**

Potential UI:
- exact OE match,
- matching donor vehicle,
- engine/generation match,
- seller photographed label,
- unresolved option warning.

Status: RESEARCH TARGET.

### 3. Registration lookup is not full compatibility

VRM/DVLA/DVSA-style vehicle identity is useful but insufficient for part-level fitment.

**Impact: HIGH**

This reinforces current product rules:
- provider lookup + internal catalogue + manual fallback,
- no fabricated compatibility,
- progressively resolve ambiguity.

Status: ALIGNED WITH CURRENT PRODUCT.

### 4. TecDoc/catalog data should be a component, not the domain model

Used parts need physical-instance provenance and seller evidence.

**Impact: MEDIUM/HIGH**

Status: FUTURE DATA ENRICHMENT; do not redesign current schema solely for TecDoc.

### 5. Verified Fit can become proprietary data

A normal review says whether the transaction felt good.
Verified Fit can say whether a real part worked on a real vehicle.

**Impact: VERY HIGH**

Status: ALIGNED WITH CURRENT PRODUCT.

### 6. Free seller subscription alone is not enough

Professional recyclers already pay for demand.
Their bigger cost is maintaining another channel.

Research recommends:
- concierge import,
- low/zero early commission,
- founder-rate benefits,
- synchronization,
- demand access,
- analytics.

**Impact: HIGH on go-to-market**

Status: ADOPT STRATEGICALLY.

### 7. Do not optimize for seller count

Prefer:
`available relevant inventory × seller responsiveness`

over raw registrations.

**Impact: HIGH**

Status: ADOPT.

### 8. Professional seller liquidity first

Research recommends professional sellers first because they provide:
- repeat inventory,
- better data,
- standardized verification,
- clearer operations.

**Impact: HIGH**

Status:
- prioritize professional seller acquisition,
- do not delete already-built private-seller capability without reason.

### 9. Three supply modes

Research proposes:

1. structured inventory/feed mode
2. donor vehicle mode
3. quick quote mode

**Impact: HIGH**

SecondPart already contains foundations for inventory, donor vehicles and buyer requests.

Status: PERFORM GAP ANALYSIS BEFORE BUILDING MORE.

### 10. Find My Part should be intelligent matching, not broadcast spam

Research recommends seller ranking and wave-based distribution.

**Impact: VERY HIGH**

Status: STRONG RESEARCH TARGET.

Suggested future signals:
- exact indexed inventory,
- matching donor,
- seller category/make performance,
- response reliability.

### 11. Normalize seller quotes

Quotes should be comparable:
- item price
- delivery
- delivered total
- OE number
- condition
- photos
- warranty
- dispatch estimate
- fitment confirmation
- inclusions

**Impact: HIGH**

Status: RESEARCH TARGET.

### 12. Own the protected transaction

Lead-generation competitors often step away once buyer and seller connect.

SecondPart's advantage can be:
- protected checkout,
- automotive-specific case reasons,
- payout policy,
- evidence,
- reviews,
- Verified Fit.

**Impact: VERY HIGH**

Status: ALIGNED WITH CURRENT COMMERCE DIRECTION.

### 13. Avoid claiming universal fit guarantee

Research recommends:
- evidence + wrong-part protection first,
- selective fit guarantee only after measured false-positive performance.

**Impact: HIGH**

Status: ADOPT.

### 14. Category-specific schemas

High-risk components need different attributes.

Examples:
- headlamp: side, technology, facelift, modules
- mirror: side, heating, folding, blind spot, camera, connector
- engine: code, emissions, production range, ancillaries
- ECU/module: coding/security constraints

**Impact: HIGH**

Status: POST-BASELINE FITMENT IMPROVEMENT.

### 15. Monetization

Research suggests:
- launch: optimize successful transactions, not revenue
- liquidity phase: roughly 5–8% transaction commission + seller tooling
- growth: category-dependent take + pro tools/logistics/B2B

**Impact: BUSINESS**

Status: NOT A CODING MANDATE until pricing is explicitly approved.

## Research ideas to postpone

Do not prioritize:
- full dismantler DMS,
- owned logistics,
- Europe,
- social,
- AI fit guarantee,
- full installer marketplace,
- promoted listings before relevance works,
- custom universal interchange DB,
- auctions,
- BNPL,
- elaborate seller storefront customization.

## Strategic metrics from research

Track:
- compatible-result rate
- zero-result rate
- Find My Part initiation
- time to first valid quote
- request fill rate
- quote-to-checkout
- wrong-fit claims
- seller cancellation
- dispatch SLA
- damage rate
- Verified Fit rate
- support cost/order
- repeat buyer rate

Research recommends treating **wrong-fit rate** as an executive quality metric.

## Final rule

Use research to improve the existing product.

Do not use it as justification to:
- delete safe, working systems,
- ignore current release blockers,
- restart commerce,
- rewrite the database without migration evidence,
- postpone already-built Android release work.
