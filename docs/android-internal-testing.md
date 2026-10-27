# SecondPart Google Play Internal Testing

## Release identity

- Play package: `com.secondpart.marketplace`
- first release: `0.1.0` / versionCode `1`
- registered dispatcher: **Android Release Pipeline Check** (`.github/workflows/android-release-check.yml`)
- protected build definition: `.github/workflows/android-internal-aab.yml` from the same `rebuild-nextjs` commit
- protected GitHub environment: `secondpart-internal-release`
- allowed source branch: `rebuild-nextjs`
- stable Internal QA origin: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`
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

- `SECOND_PART_INTERNAL_URL=https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`
- `SECOND_PART_INTERNAL_STRIPE_MODE=test`
- `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS=916508490C6854B5CFBA742AFF1A3AD3EA853B9FA21C38D1EA3733C2072F6056`

Keep the environment deployment branch rule restricted to `rebuild-nextjs`. The Stripe variable is an attestation. Set it to `test` only after the authenticated `/admin/commerce/e2e` preflight reports Stripe test mode for the exact Internal QA deployment. A hidden Vercel secret name alone does not prove its mode.

## Origin prerequisites

Use Vercel's stable `rebuild-nextjs` branch Preview alias `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`. It is HTTPS, costs no additional domain fee, and follows successful deployments from that branch. The exact deployment must:

1. use Preview/QA Supabase and Stripe test credentials;
2. expose the public Privacy, Contact and Account Deletion pages;
3. set `ANDROID_APP_LINK_SHA256_FINGERPRINTS` to the Google Play App Signing certificate;
4. return the Play package and signer from `/.well-known/assetlinks.json`;
5. keep live Stripe keys absent.

Before deploying the merged change, add branch-scoped Vercel Preview overrides for `rebuild-nextjs`: `NEXT_PUBLIC_SITE_URL` set to this stable alias, `ANDROID_APP_LINK_SHA256_FINGERPRINTS` set to the Play App Signing certificate, and `SECOND_PART_INTERNAL_STRIPE_MODE=test`. The checkout and Connect adapters then fail closed unless the runtime credential itself begins with `sk_test_` or `rk_test_`. Do not set the test attestation until an authenticated administrator has confirmed the exact deployment reports Test mode.

The workflow rejects moving `*.vercel.app` aliases, localhost, the Production domain and every origin other than `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`.

## Upload-key custody

The private JKS and its passwords must stay outside the repository. Before the first release, keep at least one tested encrypted backup in an independent location. A PEM certificate is public recovery evidence and is not a backup of the private upload key.

## Build and manual upload

1. Merge the reviewed workflow change into `rebuild-nextjs`.
2. Complete the origin, Firebase, Stripe and backup prerequisites above.
3. In GitHub Actions open **Android Release Pipeline Check**, choose **Run workflow**, select branch `rebuild-nextjs`, set `release_mode=internal`, versionName `0.1.0` and versionCode `1`.
4. Approve the protected `secondpart-internal-release` environment when GitHub requests the required reviewer.
5. Download artifact `SecondPart-Internal-AAB-0.1.0-1`.
6. Verify the AAB SHA-256 against the included `.sha256` file and retain all evidence files.
7. In Play Console open **Testing > Internal testing > Create new release**.
8. Upload `SecondPart-0.1.0-1-internal.aab`.
9. Confirm package `com.secondpart.marketplace`, versionName `0.1.0`, versionCode `1`, and Play App Signing.
10. Add release notes, save, review, and start rollout to Internal Testing only.
11. Install through the tester opt-in URL and execute the physical-device Android RC matrix.

The workflow uploads an artifact to GitHub Actions only. It has no Play Console publication step.

## Subsequent updates

Increment versionCode for every Play upload. versionName can follow the product release number. Run the same workflow from `rebuild-nextjs`, retain the evidence, upload manually to a new Internal Testing release, then verify an in-place update on the physical device.
