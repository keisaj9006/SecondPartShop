# SecondPart Android Signing and App Links

Snapshot: 2026-09-10
Package: `com.secondpart.marketplace`

This runbook keeps the two Android signing identities separate. They must not be treated as interchangeable.

## 1. Upload key

The upload key belongs to SecondPart and signs the `.aab` before it is uploaded to Google Play.

GitHub release secrets:
- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `ANDROID_RELEASE_STORE_PASSWORD`
- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`

The Production AAB workflow derives the upload certificate SHA-256 from the restored keystore and verifies that the generated AAB is signed by that same certificate.

The upload certificate is release evidence, but it is **not** the authoritative App Links certificate for an app installed from Google Play when Play App Signing is enabled.

## 2. Google Play App Signing certificate(s)

Google Play signs the APKs that are ultimately installed on users' devices. App Links therefore need the SHA-256 certificate fingerprint(s) shown by Google Play for the app-signing identity.

For current Play signing configurations there may be more than one relevant certificate fingerprint. Keep every fingerprint that Google Play instructs the app to register for API/domain association.

GitHub release secret:
- `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS`

Format:
- one or more SHA-256 fingerprints;
- comma-separated or newline-separated;
- colon-separated or plain hexadecimal forms are both accepted by the Production origin verifier.

Do not place private keys or signing passwords in this value. Certificate fingerprints are public identifiers, but the GitHub secret prevents accidental configuration drift and keeps the release input controlled.

## 3. Production website App Links configuration

The Production web environment publishes `/.well-known/assetlinks.json` from:

`src/app/.well-known/assetlinks.json/route.ts`

Production environment variable:
- `ANDROID_APP_LINK_SHA256_FINGERPRINTS`

This value must include all Google Play app-signing SHA-256 fingerprints required for the release. The route publishes them for package `com.secondpart.marketplace` with relation `delegate_permission/common.handle_all_urls`.

## 4. Required setup order

1. Create/configure the SecondPart app in Google Play Console with package `com.secondpart.marketplace`.
2. Configure Play App Signing for the app.
3. Copy the SHA-256 app-signing certificate fingerprint(s) shown by Google Play.
4. Configure those fingerprints in the Production web environment as `ANDROID_APP_LINK_SHA256_FINGERPRINTS`.
5. Configure the same expected set in GitHub Actions as `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS`.
6. Deploy the Production website.
7. Confirm `https://<production-domain>/.well-known/assetlinks.json` is public and contains the production package plus every expected Play signing fingerprint.
8. Run the Production AAB workflow.
9. The workflow runs `scripts/verify-production-origin.mjs` before `bundleRelease` and fails if the website, public policy/contact routes or App Links association are not ready.
10. Upload the verified AAB to a Play test track and run the physical App Links test from `docs/android-rc-test-matrix.md`.

## 5. Production origin gate

Before the real AAB is built, the workflow verifies that the configured Production origin:
- uses stable HTTPS rather than Preview/local/Vercel preview hosting;
- serves the SecondPart homepage;
- serves the public Privacy Policy;
- exposes a real public support email on both `/privacy` and `/contact`;
- serves the external `/account-deletion` resource;
- serves valid `/.well-known/assetlinks.json`;
- associates `com.secondpart.marketplace` with every expected Google Play app-signing fingerprint.

The upload-key fingerprint is intentionally checked separately when the AAB signature is verified.

## 6. GO / NO-GO

**GO for Play test-track RC** only when:
- Production AAB workflow passes;
- upload-key signature verification passes;
- Production origin preflight passes;
- all required Play App Signing fingerprints are present in live `assetlinks.json`;
- the generated AAB, permission report and release evidence are retained together.

**NO-GO** if any signing identity is guessed, copied from Preview, missing, or confused with the other signing role.
