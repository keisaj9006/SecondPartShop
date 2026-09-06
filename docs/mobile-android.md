# SecondPart Android

## Current phase: developer preview APK

The current Android build is a developer-only Capacitor container used for real-device QA on Android.

It loads the stable SecondPart preview deployment:

`https://second-part-shop-preview.vercel.app`

This is intentional for rapid QA while the existing Next.js marketplace remains server-rendered and uses Server Actions.

## Important production rule

Capacitor documents `server.url` as a live-reload/development option and explicitly says it is not intended for production.

Therefore this preview APK must **not** be submitted to Google Play as the production SecondPart app.

Before store release we will:

1. replace the remote preview container with a bundled mobile frontend;
2. keep Supabase and the existing backend/API contracts where appropriate;
3. add native mobile behaviours such as app lifecycle handling, deep links, media/photo flows and notifications;
4. create release signing and an Android App Bundle (AAB);
5. run store-policy, privacy, security and device QA.

## Package identity

Developer package ID: `com.secondpart.marketplace`

Do not publish this package to Google Play until the release-signing and production architecture gate is complete.
