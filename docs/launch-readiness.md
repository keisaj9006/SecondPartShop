# SecondPart Launch Readiness

Snapshot: 2026-09-10
Branch: `rebuild-nextjs`

This document is the canonical launch checklist for the Android / Google Play and public marketplace release. It deliberately separates code readiness from marketplace liquidity.

## Current verified engineering baseline

- [x] Full Next.js frontend is the Android product surface; production must not use the legacy bundled mobile shell.
- [x] Android architecture documentation is aligned with the current Capacitor wrapper + hosted Next.js frontend model.
- [x] Stable Preview signing and update-in-place path.
- [x] Dedicated production package: `com.secondpart.marketplace`.
- [x] Dedicated production AAB workflow with isolated release signing secrets.
- [x] Production-style AAB dry-run builds and verifies successfully in CI.
- [x] Android target/compile SDK 36.
- [x] Production WebView debugging and debug logging disabled.
- [x] Verified HTTPS deep-link/app-link patch path.
- [x] Native production launcher/adaptive icon and splash are generated from the versioned SecondPart vector mark and verified inside the production-style AAB pipeline.
- [x] Release merged-manifest permission audit runs after `bundleRelease`; it blocks sensitive Android permissions that SecondPart does not require and writes `android-release-permissions.txt` for Data Safety evidence.
- [x] Production AAB workflow generates a release evidence pack containing package/version, production origin, commit SHA, AAB SHA-256, signer certificate SHA-256 and merged permissions without exposing credentials.
- [x] Production AAB workflow has a live-origin preflight that checks the canonical HTTPS site, public Privacy/Contact/Account Deletion routes and Android App Links before `bundleRelease`.
- [x] App Links release logic distinguishes the SecondPart upload certificate from Google Play App Signing certificate(s); the live origin must publish every expected Play app-signing SHA-256 fingerprint. See `docs/android-signing-app-links.md`.
- [x] Physical Android RC test protocol is defined in `docs/android-rc-test-matrix.md` and protected by `validate:android-rc`; physical execution is still pending.
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
- [x] Signup requires auditable acceptance of current Terms and Privacy Policy before UGC creation.
- [x] Existing accounts can accept the current marketplace Terms from Account > Security.
- [x] UGC policy defines prohibited conduct and applies to listings, photos, reviews, requests and messages.
- [x] In-app listing/content reporting is available.
- [x] Direct Report user flow feeds the existing moderation queue.
- [x] Block / Unblock user is available for pre-purchase 1:1 messaging.
- [x] Database messaging RPCs enforce Terms acceptance and user blocks.
- [x] Seller listing/profile/photo UGC, bulk inventory imports, reviews/fit feedback and Find My Part requests are Terms-gated across relevant web/mobile paths.
- [x] Review / verified-fit Terms enforcement also exists at the database boundary.
- [x] Silent-buyer payout fallback is explicit: no payout is released from buyer inactivity alone; stale unverified shipments enter admin evidence review before the normal Buyer Protection window can start.
- [x] Payout transfer recovery code is guarded by a dedicated CI invariant suite, and the recovery migration was deployed and privilege-verified against the live `secondpart` Supabase project on 2026-09-10.
- [x] Operational account-deletion processor is implemented with hard Auth deletion, identity detachment, PII cleanup, storage cleanup, blockers and retry-safe maintenance processing.
- [x] Structured production monitoring covers uncaught server/client failures plus checkout, Stripe webhook, payout, reconciliation, push, deletion and maintenance critical paths.
- [x] Public support/privacy contact code is ready: a validated `NEXT_PUBLIC_SUPPORT_EMAIL` is rendered on `/contact` and `/privacy`, while account-linked support remains authenticated. The real Production mailbox still must be configured.
- [x] Admin System readiness surfaces Production support-contact and critical-alert configuration without displaying secret values.

## P0 — before the first real Google Play release candidate

- [ ] Choose and configure a stable production HTTPS domain/origin.
- [ ] Create the permanent Google Play upload key; store release secrets securely.
- [ ] Create/configure the Play Console app for `com.secondpart.marketplace`, enable Play App Signing, and capture every SHA-256 app-signing certificate fingerprint Google Play requires for API/domain association.
- [ ] Configure the live Production site with `ANDROID_APP_LINK_SHA256_FINGERPRINTS` and GitHub Actions with the matching expected `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS`; verify `/.well-known/assetlinks.json` publishes the complete Play signing set.
- [ ] Register the Firebase Android production app for `com.secondpart.marketplace` and store its production `google-services.json` secret.
- [ ] Run the real production AAB workflow using the production URL, upload signing key, Play App Signing fingerprint set and Firebase config; retain its AAB, permission report and release evidence files together.
- [ ] Confirm release package/version/upload signature/hash from the generated evidence pack and install/test the generated release candidate through a Google Play test track.
- [x] Finish native launcher/adaptive icon and production splash/brand assets. Verified by Android Release Pipeline Check on 2026-09-10, including generated assets, production-style `bundleRelease` and AAB verification.
- [ ] Complete physical-device RC smoke testing using `docs/android-rc-test-matrix.md`: auth, Home/Garage/navigation, seller mode, image/camera upload, deep links/app links, Stripe return, hardware Back and network loss/recovery.
- [ ] Complete physical FCM end-to-end notification testing.
- [ ] Configure and smoke-test the final production critical-alert destination after the production Vercel environment is fixed.
- [ ] Configure a real monitored `NEXT_PUBLIC_SUPPORT_EMAIL` in Production and verify it is visible on `/contact` and `/privacy` without authentication.

## P0 — before public commerce

- [x] Restore Supabase project access and deploy/verify the payout-transfer recovery migration before running the final money-flow E2E. Verified on 2026-09-10: all recovery RPCs exist as `SECURITY DEFINER`; `anon` and `authenticated` cannot execute them; `service_role` can.
- [ ] Complete a real Stripe test-mode E2E transaction: buyer checkout -> webhook confirmation -> seller fulfilment -> buyer receipt/acceptance -> payout eligibility.
- [ ] Test cancellation, refund, return/case, payment-dispute and payout-reversal paths end to end.
- [ ] Test concurrency/stock reservation with competing checkout attempts.
- [x] Decide and document the payout policy when a buyer never marks an item as received and no trusted carrier delivery event exists.
- [x] Define the account-data retention matrix for transactions, disputes, fraud prevention and legal records.
- [x] Implement the operational account deletion/anonymisation processor; a request no longer merely freezes an account. See `docs/account-data-retention.md`.
- [ ] Run destructive account-deletion E2E on a disposable QA account: request -> claim -> storage/PII cleanup -> hard Auth delete -> completed audit record.
- [ ] Final legal review of Privacy Policy and Terms with real contracting/developer identity, contact details, consumer-rights wording, seller obligations, returns/refunds, fees and retention.
- [ ] Add/configure the real public privacy/support contact suitable for the Play listing. The code path is implemented; Production mailbox configuration is still required.
- [x] Add production error/crash monitoring for web/API/checkout/commerce failures with structured logs and privacy-safe browser telemetry. See `docs/operations-monitoring.md`.

## Buyer Protection — silent buyer / unverified delivery policy

For shipped orders, SecondPart uses the following release hierarchy:

1. If the buyer explicitly accepts the item, seller payout can become eligible immediately, subject to payment/case safety checks.
2. If the buyer confirms receipt but does not immediately accept, the configured Buyer Protection release window runs before payout.
3. A future trusted carrier integration may start the same Buyer Protection window from a verified delivery event.
4. If the buyer does not confirm receipt and there is no trusted carrier delivery event, **silence alone never releases seller funds**.
5. After the configured unverified-delivery review age (default: 14 days from dispatch), the shipment appears in the admin commerce payout-review queue.
6. An administrator must review the seller's shipment/tracking reference. Approval starts the normal Buyer Protection window (default: 48 hours), sends a final notice to the buyer and notifies the seller.
7. Any buyer return/dispute/cancellation case opened before release blocks the payout.
8. Local collection is intentionally excluded from this fallback until SecondPart has a trusted collection handoff proof (for example a one-time collection code/QR or buyer confirmation).

This policy is intentionally conservative for launch: it prevents both indefinite seller holds and blind auto-release based only on buyer inactivity. Once trusted carrier delivery events are integrated and proven, manual review can be reduced for eligible tracked shipments.

## Google Play Console / policy work

- [ ] Confirm Play Console account type and verification status.
- [ ] Complete developer identity/contact verification.
- [ ] Create the app with production package `com.secondpart.marketplace` and configure Play App Signing.
- [ ] Complete App content declarations: Data safety, account deletion URL, ads declaration, app access, target audience, content rating and privacy policy.
- [ ] Provide reusable reviewer/demo access and review instructions covering buyer and seller functionality. Draft instructions exist in `docs/google-play-release-pack.md`; credentials must never be committed.
- [ ] Upload store assets: 512x512 PNG app icon, 1024x500 feature graphic and required phone screenshots.
- [ ] Finalise the proposed title, short description and full store description from `docs/google-play-release-pack.md` against the final RC.
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
