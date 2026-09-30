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

## Read-only Supabase security checkpoint

Security Advisor snapshot on 30 September reports 11 informational RLS-without-policy tables, 16 anonymous and 68 authenticated SECURITY DEFINER function warnings, and disabled leaked-password protection. No ERROR-level category was returned; this is not a clean audit or a claim that every function was re-audited today.

Direct privilege readback for all 11 no-policy tables confirms RLS enabled and no SELECT/INSERT/UPDATE/DELETE privileges for either anon or authenticated. Retain this intentional deny-all boundary. Historical function reviews are in `2026-09-15-public-rpc-security-surface.md` and subsequent grant-hardening reports; their existence does not replace fresh testing of every current function.

References: [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [anonymous function review](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated function review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No grants, policies or Auth settings were changed.

## Integration and Preview activation

- Fix commit: `cb225d03a9c589c005cc7dc63792b61784218b0c`.
- PR: https://github.com/keisaj9006/SecondPartShop/pull/6 — merged into rebuild-nextjs as `4a9c909c8d33732dff4f674be20540d55e5f17b1`.
- Feature QA: https://github.com/keisaj9006/SecondPartShop/actions/runs/36701190530 — all five jobs successful (full validation, last-stock concurrency, dispute-reversal concurrency, case-evidence concurrency and PostgreSQL marketplace scale).
- Vercel deployment `dpl_5wSDfrhiMYDs2mKEAdBbyqM3zLrm`, exact URL `https://second-part-shop-bzs9pc3r2-joannakwapis11-5369.vercel.app`, READY, Preview target.
- Stable alias `https://second-part-shop-preview.vercel.app` assigned to that deployment. `/api/mobile/v1/health` returns `ok=true`, `backendReady=true`.
- Healthcheck verifies API availability, not actual FCM delivery. No production deployment or main modification.
