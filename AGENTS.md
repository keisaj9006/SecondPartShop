# SecondPart — Codex Agent Instructions

## Mission

Finish **SecondPart** as a production-ready UK marketplace and procurement platform for used/recycled automotive parts.

SecondPart is not merely a listings website. The strategic product direction is:

> Find the correct recycled part for the buyer's exact vehicle, buy it safely, and know why it fits.

The codebase, live migrations, and current release documentation are the operational source of truth. Research informs decisions but does not automatically override implemented product behaviour.

## Repository and branch safety

- Repository: `keisaj9006/SecondPartShop`
- Active development branch: `rebuild-nextjs`
- Legacy branch: `main`
- **Do not modify, merge into, or deploy `main` unless explicitly instructed.**
- Never perform destructive database actions without inspecting migration history and current production implications first.
- Never weaken Supabase RLS to make an application bug disappear.
- Never commit secrets, `.env.local`, service-role keys, Stripe secrets, DVSA credentials, Firebase secrets, Play signing material, or provider tokens.

## Source-of-truth hierarchy

When information conflicts, use this order:

1. Current code and migrations on `rebuild-nextjs`
2. Current canonical repo documentation, especially:
   - `docs/launch-readiness.md`
   - `docs/pre-payments-roadmap.md`
   - `docs/product-decisions.md`
   - commerce/payment/account-deletion/Android runbooks
3. `docs/CURRENT_STATE.md`
4. `docs/PRODUCT_DECISIONS.md`
5. User-approved decisions supplied during the current Codex task
6. `docs/RESEARCH_INSIGHTS.md`
7. Full Deep Research under `docs/research/`

Research is evidence and strategy input, not an implementation mandate.

## Required working method

Use Superpowers.

For each meaningful task:

1. Read relevant repo documentation and inspect the current implementation.
2. Classify the task correctly.
3. For bugs, use systematic debugging and identify the root cause before editing.
4. For new or changed behaviour, use brainstorming/design approval where required by the Superpowers workflow.
5. Use TDD where practical and appropriate.
6. Keep changes small and reviewable.
7. Preserve working behaviour.
8. Run the relevant validation commands.
9. Do not claim completion without verification evidence.
10. Report:
   - what was wrong / missing,
   - what changed,
   - files changed,
   - tests and checks run,
   - residual risks,
   - recommended next task.

## Baseline verification

At minimum, for normal web changes run:

```bash
git diff --check
npm run lint
npm run typecheck
npm run build
```

Also run targeted validators when the changed area touches them:

```bash
npm run validate:notifications
npm run validate:mobile-performance
npm run validate:launch-baseline
npm run validate:monitoring
npm run validate:commerce-e2e
npm run validate:checkout-expiry-race
npm run validate:payout-recovery
npm run validate:android-rc
npm run validate:public-contact
npm run validate:account-deletion-e2e
npm run validate:production-origin
npm run validate:production-env
npm run validate:beta-feedback
npm run validate:seller-read-policy
```

Do not mechanically run destructive or real-provider E2E flows unless prerequisites and test accounts are explicitly configured.

## Product rules that must not be casually violated

### Compatibility / fitment
- Never fabricate registration lookup results.
- Never fabricate compatibility.
- Vehicle existence is not the same as part compatibility.
- `Show only parts that fit this vehicle` must not silently degrade into make/model matching.
- Fitment confidence should be evidence-based.
- Preserve the ability to explain why a part fits.
- Exact OE/OEM number, donor provenance, catalog evidence, seller confirmation, and verified-fit outcomes are distinct evidence classes.
- AI may assist extraction or drafting, but must not become the authoritative fitment decision-maker.

### Vehicle selection / Garage
- Buyers must be able to select a new vehicle without being trapped by a previously selected vehicle.
- Garage and Home should use consistent vehicle-selection semantics.
- The compatibility filter state must be explicit and understandable.
- Manual vehicle selection must remain available when provider lookup is unavailable or ambiguous.

### Marketplace access / roles
- Public users can browse marketplace content.
- Buyer and Seller account modes must be explicit.
- Sellers may also buy.
- Seller mode must not erase buyer functionality.

### Seller quality
- Professional inventory and repeatable seller operations are strategically more important than raw seller count.
- Do not optimize for vanity seller registrations.
- Inventory freshness, response reliability, verified identity, and operational quality matter more.

### Reviews / Verified Fit
- Reviews must remain transaction-backed.
- Verified Fit must be earned from completed transaction evidence and successful fit confirmation, not manually granted by sellers.
- Do not reduce Verified Fit to a decorative badge.

### Payments / Buyer Protection
- Do not create a fake wallet or DIY escrow.
- Use the existing regulated marketplace-payment architecture.
- Preserve webhook/provider authority for payment state.
- Preserve checkout reservation, expiry-race and paid-confirmation guards.
- Do not release seller money merely because the buyer is silent.
- Returns, disputes, payout reversal and reconciliation need auditable state transitions.
- Never describe the payment flow as legally regulated "escrow" unless that is actually true.

### Inventory
- Quantity-one used parts make stale inventory dangerous.
- Preserve stock reservation and oversell protections.
- Bulk import and inventory synchronization are strategic capabilities.
- Avoid forcing serious recyclers to manually list thousands of parts.

### Mobile / Android
- The current production direction is the hosted Next.js frontend inside the supported Android wrapper.
- Do not revive legacy mobile shells as the production architecture.
- Preserve package, signing, app-link and release-gate rules documented in the Android runbooks.

## What not to build without explicit approval

Do not divert engineering time into:
- social/community features,
- a full dismantler management system,
- an owned logistics fleet,
- pan-European expansion,
- a general fitting marketplace,
- promoted listings that can outrank better-fitting results,
- AI visual fit guarantees,
- a custom universal interchange database from scratch,
- large private-seller expansion before professional marketplace liquidity is proven,
- elaborate loyalty/auction/BNPL features.

## Release philosophy

Priority order:

1. Correct part
2. Available part
3. Trusted transaction
4. Reliable fulfilment
5. Competitive price

Code completion is not the same as launch readiness. Treat these as separate gates:
- engineering readiness,
- provider/payment E2E readiness,
- physical-device / Android readiness,
- legal / policy readiness,
- marketplace liquidity readiness.

Read `docs/SECOND_PART_1_0_CHECKLIST.md` before claiming that SecondPart 1.0 is launch-ready.
