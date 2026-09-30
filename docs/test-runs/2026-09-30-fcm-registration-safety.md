# 30 September 2026 — FCM registration safety and release continuation

## Confirmed defect and fix

The HTTP v1 FCM sender treated every HTTP 404, or an arbitrary response substring `UNREGISTERED` / `registration-token-not-registered`, as proof that a device token had expired. The push dispatcher then disabled the device and consumed the queued notification. A project/service error could therefore disable an otherwise valid registration.

`src/lib/push/fcm.ts` now requires a typed `type.googleapis.com/google.firebase.fcm.v1.FcmError` detail with the exact `UNREGISTERED` error code. Unknown, malformed and configuration failures retain the existing retry path. Genuine unregistration and successful delivery retain their existing behaviour. No provider response bodies or credentials are logged.

Reference: https://firebase.google.com/docs/cloud-messaging/error-codes (checked 30 September 2026).

## Verification

- Regression suite: six expected failures before the fix; 11/11 pass afterwards.
- Tests use the real sender with ephemeral synthetic signing material and mocked HTTP responses; no real push messages sent.
- Independent review: no actionable findings; reviewer independently reproduced 11/11 passing tests and checked the dispatcher integration.
- Full suite: 687/687 pass. Typecheck, production build, notification validator (29 critical event paths) and diff whitespace checks pass. Lint: zero errors, four existing warnings in unrelated files. Merge/deployment evidence is recorded separately when available.

## Hosted commerce readback (read-only)

Case `896b3b6f-f990-45c1-910b-c7e270c972b2` remains `return_shipped`. Return receipt, refund and transfer reversal IDs are null. Item remains `return_approved` with the existing released transfer. Scenario E remains incomplete. Next normal step: seller confirms receipt of the explicitly simulated QA return, then the authorised refund/reversal flow.

Browser automation retried twice; it cannot start because the Windows sandbox helper fails while applying deny-read ACLs. No alternate browser automation or manual database status mutation was used. Provider dispute/replay and account email/deletion UI tests remain open.

## Android/Firebase prerequisites

GitHub repository secret names checked (values never read): only `ANDROID_PREVIEW_KEYSTORE_BASE64` is configured. The following production inputs remain missing at repository-secret scope:

- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `ANDROID_RELEASE_STORE_PASSWORD`
- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`
- `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS`
- `GOOGLE_SERVICES_JSON_BASE64_PRODUCTION`

The server FCM credential `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`, matching Firebase Android app, final HTTPS origin and Play App Signing association still need coordinated configuration and physical-device proof. Do not send these secrets in chat or commit them. This repair does not provision Firebase, create a production signing identity, or qualify the existing Preview APK as a production release.

## Next work

1. Restore browser automation, finish normal seller receipt and test refund/reversal; verify provider evidence and idempotency.
2. Fresh disposable test transactions for provider dispute/replay, declined payment retry and last-stock competition.
3. Normal email confirmation/password recovery and disposable-account deletion E2E.
4. Configure production signing/Firebase/Play/domain, build the gated AAB and run physical-device matrix.

`main` is unchanged. Launch is still gated on provider E2E, physical-device, operational/legal and marketplace readiness.
