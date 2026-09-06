# SecondPart Android

## Current architecture: bundled Capacitor application

The Android build now packages the mobile application from `mobile-shell/` directly inside the APK.

The previous development-only `server.url` remote WebView configuration has been removed from `capacitor.config.json`.

Current request flow:

```
Bundled Android UI
  -> Supabase Auth (publishable client key only)
  -> Authorization: Bearer <user access token>
  -> /api/mobile/v1/*
  -> Supabase RLS / guarded RPCs
  -> Stripe server-side integration where required
```

The phone never receives `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` or DVSA server credentials.

## Preview endpoint configuration

`mobile-shell/config.js` currently uses the SecondPart preview alias as its API and web callback origin:

`https://second-part-shop-preview.vercel.app`

The Supabase URL and publishable key in that file are public client configuration, not privileged secrets.

Before each real-device preview cycle, the preview alias must point at a deployment containing the current `rebuild-nextjs` backend.

Before production release, replace the preview alias with the production SecondPart domain.

## Mobile API

The bundled application consumes versioned endpoints under:

`/api/mobile/v1/*`

Implemented coverage includes:

- API health/version check
- account/session profile
- public marketplace search and listing detail
- categories
- UK vehicle registration lookup
- DfT vehicle catalogue lookup
- Garage read/save/remove
- saved parts
- notifications/read state
- purchases and order detail/timeline
- buyer receipt/acceptance
- checkout reservation cancellation
- Stripe checkout creation
- returns/disputes/cancellation cases
- pre-purchase buyer/seller conversations
- paid-order transaction chat
- seller sales/payout state
- seller fulfilment
- seller transaction cases

Authentication is performed with Supabase access tokens. The API creates a Supabase client scoped to that token so Row Level Security remains the primary data-access boundary.

## Checkout

The mobile app requests Stripe Checkout through the server-side endpoint. Stripe credentials are never shipped in the application.

Payment truth remains server-controlled through Stripe webhook processing and reconciliation. The mobile client cannot mark an order paid.

The current preview return page is `/checkout/mobile-complete`. Native deep-link return handling is still a production gate.

## Remaining production mobile gates

Before Google Play release:

1. secure native token storage instead of preview localStorage;
2. native deep links / verified App Links for checkout and email flows;
3. push notifications;
4. native camera/photo picker integration for seller listings and case evidence;
5. Android lifecycle/back-navigation hardening;
6. release signing and Play App Signing;
7. generate a release Android App Bundle (AAB);
8. production API/domain configuration;
9. Play Console Data safety / privacy / store listing review;
10. final physical-device security and commerce QA.

## Package identity

Android package ID: `com.secondpart.marketplace`

Do not submit a debug APK to Google Play. Store release must use a signed release AAB.
