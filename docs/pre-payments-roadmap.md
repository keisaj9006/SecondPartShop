# SecondPart — Pre-payments roadmap

Status: **build complete on `rebuild-nextjs`; pre-QA cleanup complete; backend/static acceptance QA is passing after the first QA Fix Pass. Fresh Preview browser/mobile acceptance remains the final gate before commerce work.**

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
- CI lint, typecheck and production build pass on QA-fix commits

### Fresh Preview visual/browser acceptance — PENDING

A fresh Vercel Preview must still be tested on desktop and mobile for buyer, seller and admin interaction/visual behaviour before commerce starts. The currently connected Vercel integration does not have access to the original project team scope, so browser-level Preview QA requires that Vercel scope to be re-authorized.

Do not start the payment/order layer until this fresh Preview pass is complete.

### Remaining launch hardening

- enable Supabase leaked-password protection before public launch
- complete final legal review before real commerce

## Payment/order phase after QA

- order state machine
- checkout
- regulated marketplace payment provider
- buyer funds protection / delayed seller payout
- delivery / collection confirmation
- buyer acceptance / automatic release window
- refunds, returns and disputes
- seller payouts
- transaction history

## Deliberately later / optional

- full AI visual recognition of an unlabelled part
- buyer/seller chat
- reviews
- MOT/service reminders
- service kits
- garage fitting ecosystem
- advanced analytics/admin
