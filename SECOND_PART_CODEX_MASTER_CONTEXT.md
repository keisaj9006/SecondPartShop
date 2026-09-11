# SecondPart — Codex Master Context

## Product

SecondPart is a UK marketplace and procurement platform for used/recycled automotive parts.

The product should solve five linked problems:

1. identify the buyer's vehicle,
2. find the correct part,
3. explain compatibility confidence,
4. complete a protected transaction,
5. connect fragmented professional recycler inventory with demand.

Strategic positioning:

> Find the correct recycled part for your exact vehicle, buy it safely, and know why it fits.

## Repository

- GitHub: `keisaj9006/SecondPartShop`
- active development: `rebuild-nextjs`
- legacy: `main`
- `main` must remain untouched unless explicitly approved.

## Core stack

Current repo stack includes:
- Next.js App Router
- React
- strict TypeScript
- Tailwind CSS
- Supabase Auth
- PostgreSQL
- Supabase Storage
- Supabase Edge Functions
- Server Components
- Server Actions

Android uses the current Next.js product surface through the supported mobile wrapper/release architecture.

## Product surfaces

Current or established product areas include:
- public marketplace browsing
- search
- product detail
- vehicle selection and SecondPart Garage
- compatibility confidence
- OE/OEM/part-number search
- saved items/searches
- buyer requests / Find My Part foundations
- seller profiles
- seller onboarding
- listing creation/editing/photos
- bulk seller inventory flow
- donor vehicles
- buyer and seller account modes
- reviews
- Verified Fit
- seller reputation/trust
- purchases
- sales and payouts
- protected commerce foundations
- Stripe Connect onboarding
- notifications
- support/legal/privacy/account security
- account deletion
- Android/Google Play release pipeline

## Current strategic differentiator

SecondPart should not try to win only on listing count or price.

The highest-value differentiators are:

- evidence-based fitment confidence,
- easy professional inventory ingestion,
- targeted Find My Part matching,
- protected transaction workflow,
- structured donor/part provenance,
- Verified Fit as transaction-derived compatibility evidence.

## Core buyer model

Vehicle selection must become persistent marketplace context.

Buyer experience:

`vehicle -> part intent -> compatibility-aware search -> listing or Find My Part -> protected checkout -> delivery -> fit confirmation`

The user should not need to understand automotive catalog complexity unless ambiguity requires one additional question.

## Compatibility

Compatibility is a confidence/evidence system, not a single boolean truth.

Important evidence types include:
- exact OE/OEM number
- validated interchange/supersession
- donor match
- catalog relation
- seller confirmation
- successful Verified Fit outcome

The user-facing UI can be simple, but internal evidence must remain structured.

The label "Show only parts that fit this vehicle" must be honest: if the system lacks enough evidence, it should not silently pretend that broad model-family matching is confirmed compatibility.

## Find My Part

Find My Part is not merely a fallback form.

Long-term model:

`search -> inventory match if available -> donor/seller opportunity if partially known -> targeted seller request if unresolved`

Requests should be matched intelligently, not sprayed indiscriminately to every seller.

## Seller strategy

Early marketplace quality matters more than seller count.

Prioritize:
- professional breakers/recyclers,
- ATFs,
- garages,
- repeat inventory,
- structured feeds/imports,
- responsiveness,
- verified identity,
- inventory freshness.

Founding seller value should come from reducing operating burden:
- import/migration,
- synchronization,
- demand access,
- low early fees,
- useful analytics.

## Trust

The platform should own the protected transaction experience rather than merely introducing buyer and seller.

Important concepts:
- protected checkout
- auditable order state
- buyer-protection window
- wrong-part / not-as-described / damage / missing-item paths
- seller payout safety
- refund/return/dispute handling
- transaction-backed reviews
- Verified Fit
- immutable or durable transaction evidence where needed

## Mobile / Android

The mobile product must preserve the full marketplace experience and responsive usability.

Current launch work includes:
- production package
- signing
- AAB pipeline
- app links
- permissions audit
- release evidence
- Firebase/FCM requirements
- physical-device RC matrix
- Play Console requirements

Do not simplify release readiness to "APK builds".

## What 1.0 actually means

SecondPart 1.0 requires more than working UI.

It requires:
- code baseline passing,
- real provider E2E proof,
- Stripe test-mode transaction proof,
- cancellation/refund/return/dispute proof,
- payout proof,
- destructive account-deletion QA,
- physical Android RC QA,
- FCM E2E,
- production origin/signing/app links,
- legal/privacy/support finalisation,
- marketplace liquidity sufficient for a meaningful beta/launch.

## How to use Deep Research

Use research to:
- challenge assumptions,
- prioritize features,
- identify market gaps,
- refine architecture.

Do not:
- delete existing working systems simply because research suggests a different ideal,
- automatically postpone already-built native/mobile work,
- automatically remove private-seller capability if it already exists,
- rebuild the entire domain model without a migration strategy,
- introduce unverified commercial claims.

See `docs/DECISION_CONFLICTS.md`.
