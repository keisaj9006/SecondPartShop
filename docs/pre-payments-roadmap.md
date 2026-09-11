# SecondPart — Pre-payments roadmap

Status: **historical foundation roadmap, reconciled on 11 September 2026.** Checkout, webhook authority, fulfilment, Buyer Protection acceptance and a single test-mode seller transfer are implemented and verified at `72f9fdc`. Use [the current roadmap](ROADMAP.md), [marketplace audit](marketplace-development-audit-2026-09-11.md) and [launch checklist](launch-readiness.md) for active work; the historical foundation entries below do not supersede them.

## Completed before payments

1. **Performance hardening — DONE**
   - vehicle selector latency and loading feedback
   - reduced sequential catalogue/network work
   - cached public vehicle catalogue requests
   - parallelized selected-vehicle validation with homepage bootstrap
   - canonical VRM flow: DVSA → DfT catalogue → manual fallback
   - VDG kept disabled as optional paid enrichment only

2. **Authentication/account essentials — DONE**
   - forgot/reset password flow
   - email verification resend flow
   - signed-out / expired-session messaging
   - account security hub
   - controlled account deletion request path

3. **Seller trust and moderation baseline — DONE**
   - seller verification request/status flow
   - sellers cannot self-assign verified status
   - listing report capability
   - minimal admin moderation for verification, reports and support
   - no advanced admin suite

4. **Notifications baseline — DONE**
   - in-app notifications centre
   - seller notification for relevant buyer requests
   - buyer notification when a seller lists against a Part Request
   - saved-search match notifications for newly activated listings
   - notification read/unread workflow

5. **Legal/support launch baseline — DONE AS PRE-LAUNCH DRAFT**
   - Terms
   - Privacy
   - Buyer Protection plan
   - Help centre
   - authenticated support requests
   - global footer links
   - final legal review still required before real commerce

6. **Security/RLS hardening — DONE FOR CURRENT BUILD**
   - new tables use RLS
   - seller verification status protected at database level
   - moderation functions hardened
   - advisor issues introduced by moderation resolved
   - foreign-key indexes added where needed
   - current remaining Supabase security warning: leaked-password protection is disabled and must be enabled in Auth settings before public launch

## Pre-QA cleanup — DONE

- removed the duplicate homepage footer; the global layout footer is now the single footer source
- aligned the Server Action upload request limit with the documented 6 × 5 MB photo contract
- added server-side enforcement of the six-photo listing limit for create and edit flows
- tracked the deployed closed DfT catalogue-import Edge Function in the repository
- refreshed README/setup documentation so it matches the current migration-driven architecture
- no database schema, RLS or authentication behaviour was changed in this cleanup
- Supabase leaked-password protection remains a launch hardening setting to enable before public release

## Acceptance QA — IN PROGRESS

### Backend/static acceptance pass — PASS after QA fixes

Validated against the real Supabase project and current `rebuild-nextjs` source:

- marketplace search precision: sibling category aliases no longer create unrelated matches
- unrelated search text returns no marketplace results
- legacy vehicle fitments can support DfT catalogue searches only as `family_match`, never false `confirmed`
- DfT make alias handling includes Skoda/Škoda normalization for the legacy compatibility bridge
- buyer RLS isolation: own profile/activity visible, inactive foreign listings hidden
- seller lifecycle tested transactionally: buyer → seller upgrade, own seller profile and draft listing creation
- seller RLS prevented updating another seller's listing
- buyer saved-part functionality remains available after seller upgrade
- buyer → admin privilege escalation remains blocked
- seller/admin/new/edit/moderation/account route guards reviewed
- vehicle lookup and catalogue API failures return controlled messages without exposing raw database errors
- Part Request copy reflects the implemented privacy-safe seller demand-lead flow
- Part Request trigger verified: anonymous seller lead + seller notification are created for matching demand
- seller demand-lead storage contains request/part/vehicle context but no buyer profile ID, email or registration
- saved-search vehicle notifications now use the same legacy/catalogue compatibility resolver as marketplace results
- CI lint, typecheck and production build pass on QA-fix commits
- malformed vehicle UUIDs in marketplace/product/compare URLs are ignored instead of crashing SSR
- auth/report return paths use one same-origin redirect sanitizer, including backslash open-redirect protection
- public marketplace database failures no longer expose raw Postgres/Supabase errors
- marketplace/product/compare remain usable when vehicle-catalogue or compatibility enrichment is temporarily unavailable
- mobile static pass: product gallery height reduced on small screens and active vehicle chip now retains the selected registration
- buyer redirected from seller/admin-only routes now gets a clear access explanation and seller-upgrade CTA
- public Sellers empty state no longer exposes development/setup instructions

### Fresh Preview visual/browser acceptance — PENDING

Current GitHub, Vercel Preview, Supabase and browser access were verified in the September 11 audit. The earlier Vercel 403 is resolved. Buyer/seller purchase-to-transfer browser/provider evidence is recorded; comprehensive physical-device and admin edge-case QA remains open in the RC checklists.

Do not enable **live payment capture or live seller payouts** on the strength of the happy-path result alone. All outstanding provider, device, configuration and policy release gates still apply.

### Remaining launch hardening

- PWA/installability metadata and service worker are implemented
- Android developer-preview APK build is implemented for real-device QA; this remote-preview container is not the Google Play production architecture
- enable Supabase leaked-password protection before public launch
- complete final legal review before real commerce

## Trust + commerce phase

### Implemented foundation

- public member handles and reputation pages
- seller and buyer transaction counters based only on funds-released order items
- separate seller/buyer star ratings
- transaction-gated, double-blind reviews
- Purchases and Sales & payouts account screens
- order/payment/fulfilment/payout state fields and order-event audit trail
- private seller payment-account table
- Stripe Connect Accounts v2 recipient onboarding scaffold
- Vehicle Visual colour persistence and representative Garage cards

### Implemented since this historical foundation snapshot

- QA Seller Connect readiness and test-mode buyer checkout/payment.
- Webhook-driven payment authority, seller fulfilment, buyer receipt/acceptance and separate-charge/transfer release with replay protection.
- Conservative receipt/evidence-based payout eligibility, case handling, reconciliation and transaction-notification implementations.

### Still required before live commerce

- Provider E2E for outstanding refund/return/dispute/reversal and declined-payment/retry scenarios.
- Final mobile/Android physical-device QA, operational/provider configuration and policy sign-off.
- Resolve the current marketplace integrity/discovery defects in the active audit. Do not treat the presence of case/reconciliation code as completed provider QA.

## Deliberately later / optional

- full AI visual recognition of an unlabelled part
- buyer/seller chat
- MOT/service reminders
- service kits
- garage fitting ecosystem
- advanced analytics/admin
