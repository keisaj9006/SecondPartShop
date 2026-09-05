# SecondPart — Pre-payments roadmap

Status: active build plan for `rebuild-nextjs`.

## Build before payments

1. Performance hardening
   - vehicle selector latency and loading feedback
   - reduce sequential catalogue/network work
   - cache public vehicle catalogue requests
   - keep homepage/filter interactions responsive
   - optimize image/loading states where needed
   - canonical VRM flow: DVSA → DfT catalogue → manual fallback
   - keep VDG disabled as optional paid enrichment only

2. Authentication/account essentials
   - forgot/reset password flow
   - clear email verification state and resend path
   - robust signed-out/session-expired UX
   - account deletion/request path before launch

3. Seller trust and moderation baseline
   - seller verification workflow/status
   - listing report/flag capability
   - minimal admin/moderation view for sellers, listings and reports
   - no advanced admin suite yet

4. Notifications baseline
   - buyer: saved-search match / part-request response readiness
   - seller: new relevant buyer request
   - email/in-app notification architecture without chat dependency

5. Legal/support launch baseline
   - Terms
   - Privacy
   - Buyer Protection / Returns policy placeholder aligned with final payment provider
   - Contact / Help entry points

6. Pre-payments stabilization
   - automated CI on every change
   - security/RLS review
   - final desktop/mobile acceptance QA only after the above build is complete

## Payment/order phase after the pre-payments build

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
