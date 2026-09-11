# SecondPart 1.0 Completion Plan

Date: 2026-09-11

## Objective

Move SecondPart from a technically mature pre-release branch to a genuinely validated UK marketplace release candidate.

## Track 1 — Current-state audit

1. Read canonical docs.
2. Compare current HEAD to launch-readiness snapshot.
3. Run baseline QA.
4. Identify any stale docs.
5. Confirm external prerequisites.

Deliverable:
- one short release-gap report.

## Track 2 — Stripe test-mode E2E

Prerequisites:
- dedicated buyer QA account
- payout-ready seller QA account through real Stripe test onboarding
- checkout-ready active listing
- test inventory
- test shipping/fulfilment data

Scenarios:
A. happy path
B. cancellation
C. refund
D. return/case
E. payment dispute
F. payout reversal/recovery
G. concurrent stock=1 checkout
H. declined payment then successful retry

Do not directly fabricate Stripe-ready provider state in Supabase.

## Track 3 — Account deletion destructive QA

Use disposable QA account.

Prove:
- request
- processor claim
- storage cleanup
- retained evidence move/detach
- PII transformation
- Auth hard delete
- completion audit
- idempotent retry

## Track 4 — Production environment

Close:
- stable domain/origin
- support mailbox
- monitoring/critical alert endpoint
- Supabase Auth settings
- privacy/terms final data
- production environment validation

## Track 5 — Android / Play

Complete:
- Play app
- upload key
- Play App Signing
- signing fingerprints
- Firebase production app
- App Links
- production AAB
- install via Play test track
- physical RC matrix
- FCM E2E
- store policy forms/assets

## Track 6 — Buyer UX regression

Retest:
- new vehicle selection from Garage
- Home vehicle selection
- compatibility filter on/off
- selected vehicle persistence
- marketplace search
- product detail
- bottom/mobile navigation
- back navigation
- seller/buyer mode visibility

## Track 7 — Compatibility quality

Audit current model for:
- exact vs family fit
- unverified state
- OE evidence
- donor evidence
- fit explanation
- server-side purchase guard

Then propose small, migration-safe improvements.

Do not start a full schema rewrite before audit.

## Track 8 — Find My Part evolution

Audit current request/demand-lead implementation.

Compare to target:
- structured request
- protected buyer identity
- seller ranking
- targeted distribution
- structured quote
- buyer comparison
- response feedback

Implement only the next smallest valuable step.

## Track 9 — Inventory onboarding

Improve ability to onboard real seller inventory.

Priorities:
- robust CSV/import
- seller mapping
- inventory freshness
- quantity-one stock correctness
- future eBay/feed adapter boundary
- donor stock participation

## Track 10 — Liquidity execution

This is not only a coding task.

Targets:
- 15–30 serious professional sellers for controlled launch
- 15–20 breakers/ATFs inside broader seller base
- >=25k live listings for broader launch gate
- real requests and quotes
- real protected beta transactions

## Release decision

Do not call SecondPart 1.0 "ready" until:
- engineering passes,
- provider E2E passes,
- device E2E passes,
- legal/policy passes,
- sufficient real marketplace liquidity exists.

A smaller controlled beta with real correct-part transactions is better than a broad empty launch.
