# SecondPart — Decision Conflicts and Precedence

## Why this file exists

SecondPart has:
- a long project conversation history,
- a fast-moving codebase,
- existing specialist docs,
- a new Deep Research report.

Some recommendations conflict with already-implemented product decisions.

Codex must not treat all documents as equally authoritative.

## Precedence

1. current code/migrations
2. current canonical specialist repo docs
3. this context pack's CURRENT_STATE / PRODUCT_DECISIONS
4. latest explicit user instruction
5. research insights
6. older project conversations
7. legacy PHP/main branch behaviour

## Known conflict 1 — "payments are not implemented"

Older state:
> payments / checkout not implemented

Current state:
The repo now contains significant Stripe/checkout/order/payout logic and safety guards.

Decision:
- do not restart commerce from scratch,
- inspect and finish current architecture,
- focus on E2E proof and remaining gaps.

## Known conflict 2 — native/mobile work

Research recommendation:
> do not build native iOS/Android before mobile web proves retention

Current repo:
Android/Google Play release architecture is already substantially built and is an explicit project direction.

Decision:
- do not throw away Android work,
- continue current Android release path,
- use research only as a warning against unnecessary duplicated native product logic.

## Known conflict 3 — private sellers

Research recommendation:
> professional sellers first; postpone private sellers

Current product:
Seller type supports professional/private concepts and relevant flows may already exist.

Decision:
- do not delete private-seller capability by default,
- do prioritize professional seller acquisition and launch liquidity,
- avoid new engineering investment in private-seller-specific complexity unless needed for safety/consistency.

## Known conflict 4 — roadmap order

Older roadmap:
> finish marketplace, then payments

Current repo:
Commerce is substantially implemented.

Decision:
Current release blockers override old stage ordering.

## Known conflict 5 — compatibility domain model

Research recommends a rich:
`VehicleVariant / BuyerVehicle / DonorVehicle / PartType / PartInstance / FitmentAssertion / FitmentEvidence`

Current repo already has vehicle, fitment, listing, donor and compatibility structures.

Decision:
- do not rewrite the database merely to match terminology,
- perform a gap analysis,
- add missing evidence/provenance concepts incrementally,
- preserve migrations and existing data.

## Known conflict 6 — "fit guarantee"

Research warns against a broad fit guarantee.

Decision:
- keep compatibility confidence/evidence language,
- wrong-part protection can exist,
- do not promise universal guaranteed fit until evidence and operational policy support it.

## Known conflict 7 — Founding Seller subscription

Earlier idea:
> free seller subscription for 12 months

Research:
> free subscription alone solves the wrong problem; migration/sync/demand matter more.

Decision:
Keep low-friction/founder economics, but seller acquisition should emphasize:
- inventory import,
- operational simplicity,
- demand,
- reduced duplicate work,
- founder benefits.

## Known conflict 8 — Buy + Fit

Project direction has included garage-network / Buy + Fit concepts.

Research says:
> do not build a full installer marketplace yet.

Decision:
- do not expand Buy + Fit into a second complex marketplace before core part commerce works,
- current light partner/referral capability may remain,
- clearly stage broad coverage as post-MVP unless supply is actually sufficient.

## Known conflict 9 — AI

Current product includes an AI listing assistant.

Research warns against AI as compatibility authority.

Decision:
- AI may draft/extract/suggest,
- AI cannot create confirmed fitment truth,
- seller/user verification and structured evidence remain required.

## Required Codex behaviour

When a new request conflicts with existing behaviour:
1. identify the conflict,
2. show current implementation,
3. show the newer decision/research,
4. propose migration-safe options,
5. get approval before destructive redesign.
