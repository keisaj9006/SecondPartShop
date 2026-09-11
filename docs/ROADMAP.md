# SecondPart — Current Roadmap

This roadmap is intended for Codex sequencing.

It is not a replacement for `docs/launch-readiness.md`; that document remains the detailed launch gate.

## Active development sequence — 11 September 2026

The Stripe purchase-to-transfer happy path is verified at `72f9fdc`, including duplicate-transfer protection. It is not the next uncompleted happy-path test. Provider refund, dispute and reversal scenarios remain separate release gates.

The current evidence-based backlog and implementation sequence are in [the marketplace development audit](marketplace-development-audit-2026-09-11.md). Start with catalogue Verified Fit source consistency and photo/reservation integrity, then repair search/navigation/vehicle context, auth-to-Find-My-Part continuity and seller form resilience. Each batch must pass its regression tests, web checks, CI and the appropriate Preview checks. Do not repeat Stripe purchases for unrelated changes.

Physical-device work is grouped in [the marketplace RC checklist](manual-qa-marketplace-rc.md). DVSA activation, production release and business supply decisions remain external gates.

## Phase 0 — protect the baseline

Before feature expansion:
- keep `rebuild-nextjs` green,
- preserve RLS,
- preserve checkout/stock/payment guards,
- preserve account deletion safety,
- preserve Android release pipeline.

## Phase 1 — finish real commerce proof

Highest-priority engineering/QA track:

1. real Stripe test-mode E2E:
   - buyer checkout,
   - webhook confirmation,
   - seller fulfilment,
   - buyer receipt / acceptance,
   - payout eligibility.

2. edge flows:
   - cancellation,
   - refund,
   - return/case,
   - payment dispute,
   - payout reversal.

3. race / resilience:
   - competing stock=1 checkout,
   - declined payment then successful retry,
   - provider reconciliation.

4. destructive account-deletion E2E on disposable QA account.

Do not fake provider state in the database merely to pass QA.

## Phase 2 — production release gates

Close:
- stable production HTTPS origin/domain,
- Play Console app,
- Play App Signing / fingerprints,
- Firebase production app/config,
- permanent signing/upload setup,
- production AAB,
- App Links,
- support mailbox,
- critical alerts,
- Supabase leaked-password protection,
- final privacy/terms/legal review.

## Phase 3 — physical device RC

Run:
- auth,
- Home,
- Garage,
- vehicle selection,
- compatibility filter,
- seller mode,
- images/camera,
- Stripe return,
- deep/app links,
- back navigation,
- offline/network recovery,
- FCM end-to-end.

Treat device failures as release blockers where they affect core flow.

## Phase 4 — fitment/product integrity refinement

Use real QA findings and research to strengthen:
- compatibility confidence,
- "why this fits",
- OE/OEM evidence,
- donor provenance,
- category-specific ambiguity,
- family_match vs confirmed distinction,
- Verified Fit feedback loop.

Do not redesign schema blindly.

## Phase 5 — Find My Part as liquidity engine

Evolve existing demand/request foundations toward:
- structured request,
- vehicle context reuse,
- seller ranking,
- privacy-safe targeted distribution,
- normalized quote comparison,
- seller feedback signals.

Wave-based matching is a research-backed candidate, not yet an unconditional implementation mandate.

## Phase 6 — professional inventory onboarding

Prioritize:
- CSV reliability,
- mapping/normalization,
- seller import UX,
- duplicate/oversell handling,
- inventory freshness,
- future feed/eBay/sync integration,
- donor-stock participation.

Do not build a full dismantler DMS.

## Phase 7 — marketplace liquidity

Before broad paid acquisition:
- acquire serious professional sellers,
- prioritize breakers/ATFs,
- import real inventory,
- measure search fill rate,
- prove Find My Part response,
- complete real beta transactions,
- generate reviews only from genuine transactions.

## Phase 8 — closed beta

Measure:
- search -> compatible result rate,
- zero-result rate,
- Find My Part initiation/fill,
- time to valid quote,
- checkout conversion,
- wrong-fit rate,
- seller cancellation,
- dispatch SLA,
- damage rate,
- Verified Fit rate,
- support cost/order,
- repeat buyer rate.

## Phase 9 — public launch

Only after:
- release gates,
- transaction proof,
- Android release proof,
- legal/policy readiness,
- meaningful supply.

## Post-launch candidates

- deeper vehicle/catalog data,
- advanced donor matching,
- eBay/feed synchronization,
- B2B garage accounts,
- logistics aggregation,
- category-specific fit guarantees,
- demand analytics,
- fitting referrals,
- controlled private-seller expansion,
- EV-specific workflows.

## Do not prioritize yet

- social/community
- auctions
- loyalty
- BNPL
- full installer marketplace
- owned logistics network
- pan-European expansion
- full recycler DMS
- promoted placement ahead of fit relevance
- AI fit guarantee
