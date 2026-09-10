# SecondPart Android

## Current architecture: Capacitor wrapper + full Next.js frontend

SecondPart Android is a Capacitor wrapper around the full hosted Next.js application. Preview and Production builds deliberately configure Capacitor `server.url` to an HTTPS SecondPart origin, so the user-facing Android product loads the same Next.js frontend as the web product.

`mobile-shell/` remains the Capacitor `webDir` and contains bootstrap/native bridge assets required by the wrapper, but it is **not** the primary production UI surface.

Current runtime flow:

```text
Android Capacitor wrapper
  -> HTTPS SecondPart Next.js frontend
  -> Next.js API / server actions
  -> Supabase Auth / RLS / guarded RPCs
  -> Stripe / Firebase / vehicle-data integrations where required
```

The production wrapper must not point at localhost or a Preview hostname. Production WebView debugging and Capacitor debug logging are disabled.

The phone never receives privileged backend secrets such as `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, Firebase service-account credentials or vehicle-data server credentials.

## Preview frontend configuration

`scripts/prepare-android-preview.mjs` prepares the Preview wrapper and sets:

- package: `com.secondpart.marketplace.preview`
- app name: `SecondPart`
- HTTPS frontend: `https://second-part-shop-preview.vercel.app` by default
- `server.cleartext=false`
- WebView debugging: enabled for Preview
- Capacitor logging: debug

The Preview APK therefore exercises the full Next.js frontend rather than the old bundled marketplace UI.

Before a real-device Preview cycle, the Preview alias should point at a deployment containing the intended `rebuild-nextjs` backend/frontend state.

## Production frontend configuration

`scripts/prepare-android-production.mjs` requires `SECOND_PART_PRODUCTION_URL` and refuses to build if the URL is not HTTPS or if the hostname looks like Preview/localhost.

It sets:

- package: `com.secondpart.marketplace`
- app name: `SecondPart`
- `server.url=<canonical production HTTPS origin>`
- `server.cleartext=false`
- Android background: `#173c31`
- WebView debugging: disabled
- Capacitor logging: disabled
- push presentation options: badge, sound and alert

The full production frontend URL is verified again in the Android production workflow before `bundleRelease`.

## Mobile/native integration

The Next.js frontend can access native Android capabilities through the Capacitor wrapper and the bundled bridge generated from `mobile-native-src/native.ts`.

Native capabilities currently include:

- Android KeyStore-backed secure session storage
- Android hardware Back handling
- application lifecycle handling
- Camera / Photo Picker integration
- Capacitor Browser for Stripe and other hosted flows
- push notification permission, token registration and notification taps
- custom-scheme Preview fallback where applicable
- verified HTTPS App Links for Production completion paths

The native wrapper is intentionally thin. Business rules and transaction truth remain server-controlled.

## Checkout and hosted provider returns

Stripe checkout and seller onboarding are initiated through server-controlled SecondPart paths. Stripe secret keys are never shipped in the Android package.

Payment truth remains server-controlled through Stripe webhooks, reconciliation and payout workers. The Android client cannot mark an order paid or force seller payout state.

Relevant completion paths include:

- `/checkout/mobile-complete`
- `/seller/payments/mobile-complete`
- `/auth/mobile-complete`

Preview retains a `secondpart://...` fallback where required. Production supports verified HTTPS App Links patched into the generated Android manifest.

The application must not intercept `/auth/callback` before Supabase completes its PKCE/code exchange.

## Push notifications

Push foundation is implemented with Capacitor Push Notifications + Firebase Cloud Messaging:

- explicit user opt-in from Account
- Android permission request only after opt-in
- authenticated device-token registration
- token detachment before sign-out
- private server-side device registry
- notification-to-device outbox
- retry-safe outbox claiming
- FCM HTTP v1 sender
- invalid-token deactivation
- foreground notification refresh
- push-tap routing through the same application route map

Production delivery still requires the permanent Firebase Android app for `com.secondpart.marketplace`, production `google-services.json`, server-side Firebase credentials and a successful physical-device FCM E2E test.

## Android branding

The production Android pipeline now generates SecondPart-native launcher/adaptive icon and splash resources from version-controlled branding assets.

The generation step is verified in the no-secret release pipeline before the AAB build. The current native palette is aligned with the application UI:

- dark green `#173c31`
- lime `#d4f44d`
- white

A production-style AAB with generated branding has already passed the no-secret Android Release Pipeline Check.

Google Play store artwork remains a separate submission task: store icon, feature graphic and screenshots are not the same artifact as the native launcher resources.

## Android build pipelines

### Preview APK

`.github/workflows/android-preview-apk.yml`

- package: `com.secondpart.marketplace.preview`
- loads the full Preview Next.js frontend through HTTPS `server.url`
- debug WebView/logging enabled
- stable Preview signing key required
- Firebase Preview configuration may fall back to a CI placeholder
- produces a signed debug APK for device testing

### Production-style release validation

`.github/workflows/android-release-check.yml`

- package: `com.secondpart.marketplace`
- loads a non-Preview HTTPS production-style origin
- production WebView debugging/logging disabled
- generates and verifies SecondPart Android brand resources
- verified App Links manifest patch
- ephemeral CI signing key only
- CI Firebase placeholder
- target/compile SDK 36
- builds and verifies a signed `bundleRelease`
- proves the production release pipeline without using real production signing material

### Production AAB

`.github/workflows/android-production-aab.yml`

Manual release workflow. It requires:

- `production_url` workflow input (`SECOND_PART_PRODUCTION_URL`)
- version name and monotonically increasing version code
- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `ANDROID_RELEASE_STORE_PASSWORD`
- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`
- `GOOGLE_SERVICES_JSON_BASE64_PRODUCTION`

The workflow:

1. prepares the full Production Next.js frontend URL;
2. generates the Android project;
3. generates and verifies SecondPart launcher/adaptive icon and splash resources;
4. patches API 36, signing and verified App Links;
5. installs Production Firebase configuration;
6. builds `bundleRelease`;
7. verifies the AAB signer matches the permanent upload key;
8. uploads the signed AAB as a GitHub Actions artifact.

It does **not** automatically publish to Google Play.

## Physical Release Candidate gate

A production release is not approved solely because CI builds an AAB. The generated Release Candidate must be installed through a Google Play test track and tested on a physical Android device.

The physical RC gate must cover at minimum:

- fresh install and update-in-place
- sign-up, email confirmation, sign-in, sign-out and password recovery
- Buyer and Seller account modes
- Home / Marketplace / Garage / Inbox / Account navigation
- vehicle selection and compatibility filtering
- listing detail and saved items/searches
- seller profile, listing creation/edit/publish and image/camera upload
- checkout launch/return path in Stripe test mode
- purchases, seller sales, fulfilment and transaction messaging
- Find My Part and Buy + Fit critical paths
- push permission, token registration, foreground/background delivery and notification tap routing
- custom/verified links relevant to the RC
- offline/network-loss handling and recovery
- Android hardware Back behaviour
- app resume after backgrounding
- launcher/adaptive icon and splash appearance

Evidence should be recorded as PASS/FAIL with build version/code, device/Android version and defect/commit reference when a failure is fixed.

## Remaining production mobile gates

The code architecture is largely implemented. Remaining release work is mainly environment configuration and real-world verification:

1. choose and configure the canonical Production SecondPart HTTPS domain;
2. restore Supabase project access and deploy the pending payout-recovery migration before real commerce E2E;
3. configure the permanent Firebase Android production app and secrets;
4. create/store the permanent Google Play upload key and configure signing certificate fingerprints for App Links;
5. run the real Production AAB workflow with the final domain, Firebase config and signing key;
6. install that AAB through a Google Play test track;
7. complete physical-device RC and FCM E2E testing;
8. complete real Stripe test-mode commerce E2E and edge cases;
9. complete destructive account-deletion QA on a disposable account;
10. finish Play Console declarations, reviewer access, legal review and store artwork.

DVSA/vehicle registration lookup approval remains valuable, but it does not block the Android architecture or test release because manual vehicle selection remains the fallback.

## Package identity

Preview package ID: `com.secondpart.marketplace.preview`

Production package ID: `com.secondpart.marketplace`

Never submit a debug Preview APK to Google Play. Store release must use the signed Production AAB generated by the production workflow.
