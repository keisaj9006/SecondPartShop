# SecondPart Android

## Current architecture: bundled Capacitor application

The Android build packages the mobile application from `mobile-shell/` inside the APK/AAB and loads those local assets at runtime.

Do **not** add Capacitor `server.url` to preview or production configuration. Capacitor documents that option as an external WebView URL for live-reload development and not for production.

Current request flow:

```
Bundled Android UI
  -> Supabase Auth (publishable client key only)
  -> Authorization: Bearer <user access token>
  -> https://<SecondPart backend>/api/mobile/v1/*
  -> Supabase RLS / guarded RPCs
  -> Stripe / Firebase / DVSA server-side integrations where required
```

The phone never receives `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, Firebase service-account credentials or DVSA server credentials.

## Preview endpoint configuration

`mobile-shell/config.js` contains the API and web callback origin used by the bundled UI.

Preview currently points to:

`https://second-part-shop-preview.vercel.app`

The Supabase URL and publishable key in that file are public client configuration, not privileged secrets.

Before each real-device preview cycle, the preview alias must point at a deployment containing the current `rebuild-nextjs` backend. The mobile UI itself remains bundled locally; only data/API calls and hosted provider callbacks use the remote origin.

Production release preparation rewrites these API/callback values to the canonical production HTTPS origin without introducing Capacitor `server.url`.

## Mobile API

The bundled application consumes versioned endpoints under:

`/api/mobile/v1/*`

Implemented coverage includes:

- API health/version check
- account/session profile
- public marketplace search and listing detail
- categories
- UK vehicle registration lookup adapter
- DfT vehicle catalogue lookup
- Garage read/save/remove
- saved parts, saved searches and recently viewed
- notifications/read state
- push-device registration
- purchases and order detail/timeline
- buyer receipt/acceptance
- checkout reservation cancellation
- Stripe checkout creation
- returns/disputes/cancellation cases and evidence
- pre-purchase buyer/seller conversations
- paid-order transaction chat
- Find My Part / Wanted Parts
- Buy + Fit garages, fitting requests, quote acceptance and fitting chat
- seller profile / verification / readiness
- seller payments refresh and Stripe Connect onboarding
- seller sales/payout state and fulfilment
- seller donor vehicles
- seller listing create/edit/publish/photos
- seller matched buyer requests
- native CSV preview/import/report/review flow

Authentication is performed with Supabase access tokens. The API creates a Supabase client scoped to that token so Row Level Security remains a primary data-access boundary.

## Checkout and hosted provider returns

The mobile app requests Stripe Checkout through a server-side endpoint. Stripe credentials are never shipped in the application.

Payment truth remains server-controlled through Stripe webhook processing and reconciliation. The mobile client cannot mark an order paid.

Implemented return paths:

- `/checkout/mobile-complete`
- `/seller/payments/mobile-complete`
- `/auth/mobile-complete`

Preview retains the `secondpart://...` custom-scheme fallback. Production Android supports verified HTTPS App Links for the completion paths above.

The app never intercepts `/auth/callback` before Supabase completes its server-side PKCE/code exchange.

## Push notifications

Push foundation is implemented with Capacitor Push Notifications + FCM:

- explicit user opt-in from Account
- Android permission request only when the user opts in
- authenticated device-token registration
- token detached before sign-out
- private server-only device registry
- notification-to-device outbox
- retry-safe outbox claiming
- FCM HTTP v1 server sender
- invalid-token deactivation
- foreground notification refresh
- push-tap native routing through the same route map as in-app notifications

Production delivery requires Firebase service-account credentials and the real Android `google-services.json` supplied as deployment / CI secrets.

Push outbox dispatch is protected by `PUSH_DISPATCH_SECRET` or `CRON_SECRET`. Scheduling is environment-dependent and must respect the hosting plan's cron limits.

## Native Android capabilities implemented

- Android KeyStore-backed secure session storage
- migration away from legacy native localStorage sessions
- bundled local mobile UI
- Capacitor Browser for Stripe Checkout / Stripe Connect
- custom-scheme preview deep-link fallback
- verified HTTPS App Link architecture
- safe email-confirmation/password-reset completion return
- Android hardware Back integration
- app lifecycle refresh handling
- Camera / Photo Picker integration
- private transaction-case evidence uploads
- seller inventory photo capture / gallery selection
- seller donor-vehicle management
- native seller listing create/edit/publish
- native exact fitment evidence tools
- native CSV inventory import
- native Buy + Fit
- push opt-in / registration / native routing

## Android build pipelines

### Preview APK

`.github/workflows/android-preview-apk.yml`

- package: `com.secondpart.marketplace.preview`
- debug APK
- preview API/callback origin
- stable preview debug signing
- may use a CI Firebase placeholder when real preview Firebase configuration is not present

### Production-style release validation

`.github/workflows/android-release-check.yml`

- package: `com.secondpart.marketplace`
- WebView debugging disabled
- local bundled UI
- verified App Links manifest patch
- ephemeral CI signing key
- CI-only Firebase placeholder
- builds `bundleRelease`
- proves the release pipeline without using production signing material

### Production AAB

`.github/workflows/android-production-aab.yml`

Manual only. It requires:

- production HTTPS origin
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_SERVICES_JSON_BASE64`

It creates a signed AAB artifact but does **not** automatically publish to Google Play.

## Remaining production mobile gates

The architecture is implemented. Remaining work is mainly environment, store and real-device validation:

1. choose and configure the canonical production SecondPart HTTPS domain;
2. configure Firebase Android project + production service-account secret;
3. set production signing certificate SHA-256 in `ANDROID_APP_LINK_SHA256_FINGERPRINTS`;
4. configure permanent release keystore / Google Play App Signing;
5. choose an appropriate push-dispatch schedule for the hosting plan;
6. Play Console Data Safety, privacy policy and store listing review;
7. physical-device release/security/commerce QA;
8. DVSA credentials when official access is granted.

DVSA is not a blocker for the rest of the app because manual catalogue vehicle selection remains a complete fallback.

## Package identity

Preview package ID: `com.secondpart.marketplace.preview`

Production package ID: `com.secondpart.marketplace`

Do not submit a debug APK to Google Play. Store release must use a signed release AAB.
