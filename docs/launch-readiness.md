# SecondPart Launch Readiness

Snapshot: 2026-09-09
Branch: `rebuild-nextjs`

This document is the canonical launch checklist for the Android / Google Play and public marketplace release. It deliberately separates code readiness from marketplace liquidity.

## Current verified engineering baseline

- [x] Full Next.js frontend is the Android product surface; production must not use the legacy bundled mobile shell.
- [x] Stable Preview signing and update-in-place path.
- [x] Dedicated production package: `com.secondpart.marketplace`.
- [x] Dedicated production AAB workflow with isolated release signing secrets.
- [x] Production-style AAB dry-run builds and verifies successfully in CI.
- [x] Android target/compile SDK 36.
- [x] Production WebView debugging and debug logging disabled.
- [x] Verified HTTPS deep-link/app-link patch path.
- [x] Marketplace keyset pagination for default browse and major sort modes.
- [x] Keyset pagination for default catalogue compatibility.
- [x] Seller inventory keyset pagination.
- [x] Distance V2 computes distance once per seller and correctly requests page-size + 1.
- [x] Search candidates are bounded/indexed.
- [x] Home cards use a lean payload.
- [x] Bulk seller CSV import is chunked for large inventories.
- [x] Saved-search notification processing is queued/batched.
- [x] Native persistent navigation chrome and root-tab loading boundaries.
- [x] Code-level launch baseline runs in normal QA.
- [x] Public privacy route exists.
- [x] In-app account deletion request exists.
- [x] Public external account-deletion route exists.
- [x] Terms reflect the current Stripe/buyer-protection architecture.

## P0 — before the first real Google Play release candidate

- [ ] Choose and configure a stable production HTTPS domain/origin.
- [ ] Create the permanent Google Play upload key; store release secrets securely.
- [ ] Register the Firebase Android production app for `com.secondpart.marketplace` and store its production `google-services.json` secret.
- [ ] Run the real production AAB workflow using the production URL, signing key and Firebase config.
- [ ] Confirm release package/version/signature and install/test the generated release candidate through a Google Play test track.
- [ ] Finish native launcher/adaptive icon and production splash/brand assets.
- [ ] Complete physical-device RC smoke testing: sign-up/sign-in/logout/recovery, Home/Garage/navigation, seller mode, image/camera upload, deep links, app links, network loss/recovery.
- [ ] Complete physical FCM end-to-end notification testing.

## P0 — before public commerce

- [ ] Complete a real Stripe test-mode E2E transaction: buyer checkout -> webhook confirmation -> seller fulfilment -> buyer receipt/acceptance -> payout eligibility.
- [ ] Test cancellation, refund, return/case, payment-dispute and payout-reversal paths end to end.
- [ ] Test concurrency/stock reservation with competing checkout attempts.
- [ ] Decide and document the payout policy when a buyer never marks an item as received and no trusted carrier delivery event exists.
- [ ] Define the account-data retention matrix for transactions, disputes, fraud prevention and legal records.
- [ ] Implement and test the operational account deletion/anonymisation processor; a request must not merely freeze an account.
- [ ] Final legal review of Privacy Policy and Terms with real contracting/developer identity, contact details, consumer-rights wording, seller obligations, returns/refunds, fees and retention.
- [ ] Add a public privacy/support contact suitable for the Play listing.
- [ ] Add production error/crash monitoring and alerting for web/API/checkout failures.

## Google Play Console / policy work

- [ ] Confirm Play Console account type and verification status.
- [ ] Complete developer identity/contact verification.
- [ ] Create the app with production package `com.secondpart.marketplace`.
- [ ] Complete App content declarations: Data safety, account deletion URL, ads declaration, app access, target audience, content rating and privacy policy.
- [ ] Provide a reusable reviewer/demo account and review instructions covering buyer and seller functionality.
- [ ] Upload store assets: 512x512 PNG app icon, 1024x500 feature graphic and required phone screenshots.
- [ ] Write/finalise title, short description and full store description.
- [ ] Run Internal testing.
- [ ] If the Play developer account is a personal account created after 2023-11-13: run Closed testing with at least 12 continuously opted-in testers for 14 days before applying for Production access.
- [ ] Submit production release and resolve any Play review findings.

## Marketplace liquidity gate before paid buyer acquisition

Snapshot from Supabase on 2026-09-09:
- Active parts: 6
- Sellers with active listings: 3
- Sellers total: 4
- Verified sellers: 3
- Breakers classified in seller data: 0
- CRM seller prospects: 63
- Prospects currently engaged/contacted/qualified/onboarding/active: 0
- Orders: 0
- Reviews: 0
- Find My Part requests: 0
- Buy + Fit garage partners: 0
- Seller Stripe payout-ready accounts: 0

Target launch gate:
- [ ] >= 30 large active sellers.
- [ ] >= 15-20 breakers within that seller base.
- [ ] >= 25,000 live listings.
- [ ] Search fill rate measured and acceptable across target part categories.
- [ ] Find My Part fallback proven with real seller responses.
- [ ] Protected Payment and delivery/collection flows proven with real beta transactions.
- [ ] Reviews seeded only through genuine verified beta transactions.
- [ ] Buy + Fit garage network has enough coverage to be useful, or is clearly staged as post-MVP rather than implied as universally available.

## Marketing sequencing

### Can start now
- Founding Seller Programme.
- Breaker / ATF / garage outreach.
- Meetings with high-inventory sellers.
- Seller onboarding interviews.
- CSV/import preparation.
- Organic behind-the-scenes content and waitlist building.

### Do not scale yet
- Broad paid buyer acquisition.
- Promises of nationwide inventory depth.
- Campaigns whose landing experience depends on DVSA registration lookup before approval/configuration.
- Large consumer PR push before the liquidity gate and closed-beta evidence.

## DVSA

DVSA registration lookup is valuable but must not block the application architecture or test launch. Manual vehicle selection remains the production fallback until approved credentials and the final data agreement are available.
