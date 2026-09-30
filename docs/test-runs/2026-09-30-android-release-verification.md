# Android SDK release repair and Preview artifact — 30 September 2026

## Actual failure and repair

Release check run 36698378838 failed in setup-android v3: its default SDK packages included tools, which sdkmanager could no longer find. Production AAB had the same default; Preview already explicitly requested platform-tools.

PR #5 adds packages: platform-tools to release-check and production-aab. No version, signing, production-origin, package, permission or artifact gates were removed. Two expected RED contract failures became GREEN (6 focused tests). Independent review found no blocking issue.

## Verified executions

- Auth origin PR #4 merged as f03b005. Full local tests 674/674, lint (four existing warnings), typecheck and build PASS; feature QA 36698370400 all five jobs PASS. Stable Preview alias moved to READY deployment dpl_A8aRrkYxaSNVNHcrhvXsfDK613aw / second-part-shop-gxnt9uw4x-joannakwapis11-5369.vercel.app. Health returns ok=true/backendReady=true. Browser lifecycle blocked by local Windows sandbox startup failure.
- Android Preview build 36698388297 PASS at 6f756e1. Existing persistent Preview signer verified by CI. Local apksigner verification PASS after download.
- Repaired production-style AAB check 36698905842 PASS at 68b2e52, superseding the SDK failure. This uses a synthetic .invalid origin and CI-only signing/Firebase fixtures; never present this AAB as a deployable production artifact.
- Final QA 36698916940: five jobs PASS, 676 tests PASS / 0 fail, all configured release validators, lint/typecheck/build and real PostgreSQL proofs.
- PR #5 merged into rebuild-nextjs as 10acd40; main untouched.

## Downloaded Preview identity

- Directory: C:/Users/joann/Downloads/SecondPart-QA-2026-09-30-run-36698388297
- File: SecondPart-Android-Preview-Manual/SecondPart-preview.apk
- Size: 9,961,422 bytes
- SHA256: 519C9DCEEFD7522218FA1CFC2CA26D60027982654570B31568178463F9E505C1
- Package com.secondpart.marketplace.preview; versionName 1.0; versionCode 1; minSdk 24; targetSdk 36.
- Signer SHA256: 88cc9ee28f30ca971ccfc6d217543f0c0d64f1a84ffd0ebf2043a1ced685619e.
- Hosted frontend follows the rebuild-nextjs branch alias. Firebase is a CI fallback because GOOGLE_SERVICES_JSON_BASE64 is absent; physical FCM readiness is not claimed.

## Remaining release gates

Only ANDROID_PREVIEW_KEYSTORE_BASE64 is present in GitHub secrets (names-only inspection). Production keystore/password/alias, Play signing fingerprints and production Firebase inputs remain unconfigured. No adb device is attached. No Play install, physical FCM, camera/Back/Stripe-return or genuine email lifecycle has been signed off. Sandbox return still needs seller receipt and final refund/provider evidence. Business/legal/support/domain and real inventory remain external gates. Full RC still NOT GO.
