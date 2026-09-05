# SecondPart — Pre-payments roadmap

Status: **build complete on `rebuild-nextjs`; final manual acceptance QA intentionally deferred until the end.**

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

## Final pre-payments step

**FULL ACCEPTANCE QA — NOT STARTED YET BY DESIGN**

Run one consolidated desktop/mobile buyer/seller/admin QA after the current build is deployed to a fresh Preview. Fix all failures in one QA Fix Pass before starting real commerce.

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
