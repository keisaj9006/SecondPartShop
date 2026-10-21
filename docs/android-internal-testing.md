# SecondPart Google Play Internal Testing

## Release identity

- Play package: `com.secondpart.marketplace`
- first release: `0.1.0` / versionCode `1`
- workflow: `.github/workflows/android-internal-aab.yml`
- protected GitHub environment: `secondpart-internal-release`
- allowed source branch: `rebuild-nextjs`
- stable Internal QA origin: `https://internal.secondpart.co.uk`
- approved upload certificate SHA-256: `98:E6:9A:95:86:34:74:70:04:86:39:C5:A8:88:D4:83:59:5A:4B:4E:E4:56:57:24:66:1B:88:F9:F1:3C:16:70`
- Google Play App Signing SHA-256: `91:65:08:49:0C:68:54:B5:CF:BA:74:2A:FF:1A:3A:D3:EA:85:3B:9F:A2:1C:38:D1:EA:37:33:C2:07:2F:60:56`

Internal Testing uses the same Play package as future Production so Google Play can update the installed app. It uses a separate HTTPS backend origin and protected release environment.

## Required GitHub environment configuration

Secrets:

- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`
- `ANDROID_RELEASE_STORE_PASSWORD`
- `ANDROID_RELEASE_KEYSTORE_BASE64`
- `GOOGLE_SERVICES_JSON_BASE64_INTERNAL`

Variables:

- `SECOND_PART_INTERNAL_URL=https://internal.secondpart.co.uk`
- `SECOND_PART_INTERNAL_STRIPE_MODE=test`

Keep the environment deployment branch rule restricted to `rebuild-nextjs`. The Stripe variable is an attestation. Set it to `test` only after the authenticated `/admin/commerce/e2e` preflight reports Stripe test mode for the exact Internal QA deployment. A hidden Vercel secret name alone does not prove its mode.

## Origin prerequisites

Configure `internal.secondpart.co.uk` as a dedicated Vercel Preview/QA domain without changing the Production domain. The exact deployment must:

1. use Preview/QA Supabase and Stripe test credentials;
2. expose the public Privacy, Contact and Account Deletion pages;
3. set `ANDROID_APP_LINK_SHA256_FINGERPRINTS` to the Google Play App Signing certificate;
4. return the Play package and signer from `/.well-known/assetlinks.json`;
5. keep live Stripe keys absent.

The workflow rejects moving `*.vercel.app` aliases, localhost, the Production domain and every origin other than `https://internal.secondpart.co.uk`.

## Upload-key custody

The private JKS and its passwords must stay outside the repository. Before the first release, keep at least one tested encrypted backup in an independent location. A PEM certificate is public recovery evidence and is not a backup of the private upload key.

## Build and manual upload

1. Merge the reviewed workflow change into `rebuild-nextjs`.
2. Complete the origin, Firebase, Stripe and backup prerequisites above.
3. In GitHub Actions run **Android Internal QA AAB** with versionName `0.1.0` and versionCode `1`.
4. Download artifact `SecondPart-Internal-AAB-0.1.0-1`.
5. Verify the AAB SHA-256 against the included `.sha256` file and retain all evidence files.
6. In Play Console open **Testing > Internal testing > Create new release**.
7. Upload `SecondPart-0.1.0-1-internal.aab`.
8. Confirm package `com.secondpart.marketplace`, versionName `0.1.0`, versionCode `1`, and Play App Signing.
9. Add release notes, save, review, and start rollout to Internal Testing only.
10. Install through the tester opt-in URL and execute the physical-device Android RC matrix.

The workflow uploads an artifact to GitHub Actions only. It has no Play Console publication step.

## Subsequent updates

Increment versionCode for every Play upload. versionName can follow the product release number. Run the same workflow from `rebuild-nextjs`, retain the evidence, upload manually to a new Internal Testing release, then verify an in-place update on the physical device.
