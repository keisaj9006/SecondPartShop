# SecondPart Launch Readiness

Snapshot: 2026-09-11
Branch: `rebuild-nextjs`

This document is the canonical launch checklist for the Android / Google Play and public marketplace release. It deliberately separates code readiness from marketplace liquidity, and it distinguishes code-level safeguards from real provider/device E2E evidence.

## Current verified engineering baseline

Continuing commerce QA has now produced a real test-mode paid order. It exposed a purchase-display bug when sold listings become hidden by RLS; buyer-scoped order reads now retain purchased item identity without changing RLS. Buyer acceptance and seller-transfer release still require E2E verification.

Commerce QA update (2026-09-11): QA Seller Connect and Preview webhook delivery/replay are verified in test mode. The first application checkout exposed an invalid V1 API version (`2026-08-26.clover`); the adapter now uses the sandbox's supported `2026-08-26.dahlia`, with regression coverage. Full purchase/fulfilment/transfer evidence remains pending. See `docs/test-runs/2026-09-11-commerce-preview-preflight.md`.

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
- [x] Native FCM foreground refresh and safe same-origin notification tap-routing are implemented; the admin smoke tool uses the normal notification trigger/outbox/dispatcher path. Physical execution remains pending under `docs/fcm-e2e-runbook.md`.
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
- [x] Checkout reservation code serialises last-stock acquisition at the database row level; the active checkout path inherits the `FOR UPDATE` protection through `prepare_checkout_order_v2`.
- [x] Stripe checkout expiry race protection is deployed and privilege-verified live: generic database timeout cannot cancel a reservation after a Stripe Checkout Session exists, and provider-backed expiry is decided by Stripe webhook/reconciliation. `validate:checkout-expiry-race` is enforced in CI.
- [x] Retryable Stripe `payment_intent.payment_failed` no longer releases stock by itself; provider state is reconciled and only provider-confirmed expiry/final async failure can release the reservation.
- [x] Terminal Stripe Checkout expiry / async payment failure now restores inventory and creates a deduplicated buyer notification atomically in `cancel_checkout_order`; the notification links back to the affected order without exposing payment secrets.
- [x] Stripe paid confirmation now serialises against terminal cancellation on the authoritative order row and rejects a mismatched Checkout Session at the database boundary. Migration `20260911093000_confirm_checkout_paid_provider_guard.sql` was deployed and privilege-verified against the live `secondpart` Supabase project on 2026-09-11; only `service_role` can execute the function.
- [x] Commerce release QA includes Scenario H: declined payment attempt -> retry -> successful payment, specifically guarding against `paid at Stripe / cancelled in SecondPart` split-brain state.
- [x] Operational account-deletion processor is implemented with hard Auth deletion, identity detachment, PII cleanup, storage cleanup, blockers and retry-safe maintenance processing.
- [x] Account-deletion completion verifies identity state directly against Supabase Auth and fails closed when Auth deletion cannot be confirmed; partially completed deletions can retry the hard-delete safely.
- [x] Retained transaction-case evidence is moved through the Storage API to a deterministic service-role retained path before Auth deletion; the deleted profile UUID/original filename is removed while required evidence remains retained.
- [x] Structured production monitoring covers uncaught server/client failures plus checkout, Stripe webhook, payout, reconciliation, push, deletion and maintenance critical paths.
- [x] Public support/privacy contact code is ready: a validated `NEXT_PUBLIC_SUPPORT_EMAIL` is rendered on `/contact` and `/privacy`, while account-linked support remains authenticated. The real Production mailbox still must be configured.
- [x] Admin System readiness surfaces Production support-contact and critical-alert configuration without displaying secret values.
- [x] Seller SELECT RLS policies are consolidated without changing access semantics: anonymous users see only active/non-deleted sellers, while authenticated admins retain deleted-record audit access. Supabase Performance Advisor no longer reports `multiple_permissive_policies` for `sellers`.
- [x] Full branch QA at commit `95fb124183ea22e7875262d81206120b0b974dbb` passed on 2026-09-11, including lint, TypeScript, checkout-race, payout-recovery, seller-read-policy and production Next.js build.
- [x] Full local branch QA at commit `79f9eca5c4b287d2fcc8b33a779e148e0109fd20` passed on 2026-09-11 after the live paid-confirmation guard deployment, including lint, TypeScript, launch baseline, Commerce E2E harness, checkout-race, payout-recovery, seller-read-policy and production Next.js build.
- [x] Public branch Preview smoke QA at commit `328eb18b9d5ce0d85517498bd0bc23a825320f44` passed on 2026-09-11 across clean vehicle selection, marketplace browse, product detail, sellers, garages, seller entry, account entry and trust/policy routes. The current branch Preview is `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`; the convenience alias `second-part-shop-preview.vercel.app` still points to an older deployment and must be repointed before it is used for RC review.

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
- [ ] Complete physical FCM end-to-end notification testing using `docs/fcm-e2e-runbook.md`; server-side FCM acceptance alone is not a PASS.
- [ ] Configure and smoke-test the final production critical-alert destination after the production Vercel environment is fixed.
- [ ] Configure a real monitored `NEXT_PUBLIC_SUPPORT_EMAIL` in Production and verify it is visible on `/contact` and `/privacy` without authentication.

## P0 — before public commerce

- [x] Restore Supabase project access and deploy/verify the payout-transfer recovery migration before running the final money-flow E2E. Verified on 2026-09-10: all recovery RPCs exist as `SECURITY DEFINER`; `anon` and `authenticated` cannot execute them; `service_role` can.
- [x] Deploy and privilege-verify `20260911080000_checkout_expiry_provider_guard.sql` on the live `secondpart` Supabase project. Verified on 2026-09-11: provider-backed reservations cannot be cancelled by generic DB expiry; `anon`/`authenticated` cannot execute `cancel_checkout_order`; `service_role` can.
- [x] Deploy `20260911084500_checkout_terminal_buyer_notification.sql`. Verified on 2026-09-11: terminal Checkout expiry/final async failure cancellation and buyer notification are atomic and deduplicated; the cancel RPC remains service-role only.
- [x] Deploy `20260911093000_confirm_checkout_paid_provider_guard.sql`. Verified on 2026-09-11: paid confirmation locks the order row, rejects cancelled orders and mismatched Checkout Sessions, and remains executable only by `service_role`.
- [ ] Complete a real Stripe test-mode E2E transaction: buyer checkout -> webhook confirmation -> seller fulfilment -> buyer receipt/acceptance -> payout eligibility.
  - Blocked as of 2026-09-11 on test-data prerequisites, not application code: the live project has no dedicated buyer QA account, no Stripe test-mode payout-ready seller and no checkout-ready active listing. Create these through the normal signup, listing and Stripe Connect onboarding flows; do not fabricate payment-provider state in the database.
- [ ] Test cancellation, refund, return/case, payment-dispute and payout-reversal paths end to end.
- [ ] Test Scenario G concurrency/stock reservation with stock `1` and competing checkout attempts; exactly one reservation must win and cancellation/expiry must restore stock at most once.
- [ ] Test Scenario H with a declined Stripe test payment followed by a successful retry in the same Checkout flow; stock must remain reserved after the failed attempt and the order must finish paid exactly once.
- [x] Decide and document the payout policy when a buyer never marks an item as received and no trusted carrier delivery event exists.
- [x] Define the account-data retention matrix for transactions, disputes, fraud prevention and legal records.
- [x] Implement the operational account deletion/anonymisation processor; a request no longer merely freezes an account. See `docs/account-data-retention.md`.
- [ ] Run destructive account-deletion E2E on a disposable QA account: request -> claim -> listing-image cleanup -> retained case-evidence ownership/path detach -> PII transformation -> hard Auth delete -> completed audit record -> idempotent second pass.
- [ ] Enable Supabase Auth leaked-password protection and verify it remains enabled before public account creation at scale. This is a project Auth setting and is not changed by database migrations.
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
