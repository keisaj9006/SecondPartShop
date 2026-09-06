# SecondPart — Pre-payments roadmap

Status: **marketplace foundation and backend/static QA are passing on `rebuild-nextjs`. Trust/reputation, Vehicle Visual and Commerce Core foundations are now implemented. Fresh Preview/mobile QA and Stripe test-mode integration are the next gates before real payment capture.**

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

A fresh Vercel Preview must still be tested on desktop and mobile for buyer, seller and admin interaction/visual behaviour before commerce starts. The currently connected Vercel plugin is enabled but returns zero teams and 403 for the previous Preview URL, so browser-level Preview QA requires re-authorizing the Vercel connection to the original project team scope.

Trust and commerce foundations have now been added by explicit product direction. Do not enable **live payment capture or live seller payouts** until a fresh Preview/mobile acceptance pass and Stripe test-mode end-to-end QA are complete.

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

### Still required before live commerce

- Stripe test credentials and seller onboarding end-to-end QA
- buyer checkout and payment creation
- webhook-driven payment state
- delivery / collection confirmation
- buyer acceptance / automatic release window
- real separate-charge/transfer release logic
- refunds, returns and disputes
- payout/transfer reconciliation
- transaction notifications and final mobile QA

## Deliberately later / optional

- full AI visual recognition of an unlabelled part
- buyer/seller chat
- MOT/service reminders
- service kits
- garage fitting ecosystem
- advanced analytics/admin
