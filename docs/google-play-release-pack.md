# SecondPart — Google Play Release Pack

Snapshot: 2026-09-18
Package: `com.secondpart.marketplace`
Status: pre-submission working pack; re-check against the exact production AAB and Play Console forms on submission day.

This document keeps the Google Play release answers consistent. Credentials, signing secrets, Firebase files, Stripe secrets and personal verification documents must never be committed here.


## Current RC evidence snapshot

This pack is aligned to the latest fully verified application-code boundary rather than the older 2026-09-10 snapshot:

- verified application SHA: `6159916e6eda8ce6ab9c726377f51b51255a784b`;
- GitHub Actions `35359425939`: `validate`, `marketplace-scale-postgres` and `last-stock-concurrency` all SUCCESS, including **614/614 tests**, commerce/release validators and production build;
- exact Preview deployment `dpl_CagJASFvVzYYB8BqEynzUapuBPaz`: READY;
- Android Preview artifact source SHA `b0ff850904abc073d0e2b9a50ba1e1dcb5aad048`, workflow `35214653966`, artifact id `10493049326`, digest `sha256:99c819b6a6ee5297fbc1650ac7f893aff7b847371d7c48ee78a2d893f7e352cf`;
- current Production pipeline explicitly enforces Android 16 / API 36 (`compileSdkVersion = 36`, `targetSdkVersion = 36`), matching the Google Play target-API requirement effective 2026-08-31;
- direct inspection of the retained Preview APK found native `.so` libraries with 16 KB (`0x4000`) ELF LOAD alignment and 16 KB-aligned uncompressed APK data offsets; repeat this compatibility check on the exact submitted Production AAB/Play Console because Preview artifact evidence is not the final release gate;
- the Preview Android artifact is build/signing evidence only; the physical-device/test-track matrix remains external;
- Stripe sandbox evidence includes the normal commerce happy path plus one genuine full-refund flow after payout release, including a successful payout reversal and idempotent provider retry;
- decline/abandon/retry and full provider/UI last-stock race remain unsigned because they require a truthful active checkout-ready disposable listing;
- Find My Part seller-response comparison is engineering/exact-Preview verified;
- selected-vehicle checkout fails closed if compatibility verification is unavailable, before stock reservation or Stripe session creation;
- buyer transaction list/detail screens fail closed on data-loader failures instead of manufacturing empty/404 states, and mobile buyer order history retains sold-item identity through the existing authorized minimal fallback;
- transaction-case evidence read paths fail closed when Storage cannot generate a signed URL, preventing partial evidence sets from being presented as complete;
- case-evidence upload registration failures now have a source-controlled durable cleanup outbox/worker design with a safe pre-migration exact-path fallback; hosted retry is **not** claimed active until `20260918154500_case_evidence_cleanup_outbox.sql` is explicitly deployed and read back;
- destructive account deletion still requires the controlled Supabase Auth TokenHash email-template change and a fresh disposable confirmed account;
- the current Supabase organisation is on Free; leaked-password protection is a Pro+ configuration gate and is not an application-code defect.

Do not use this section to waive the remaining external/provider/device gates.

## 1. Store identity

### App name
**SecondPart – Used Car Parts**

### Proposed short description
**Find, buy and sell used car parts with vehicle fit checks and buyer protection.**

### Proposed full description
SecondPart is a UK marketplace built to make finding the right used car part simpler.

Search used vehicle parts, filter listings, save parts and searches, and use vehicle compatibility information before you buy. If you cannot find what you need, Find My Part lets you send a request that relevant sellers can respond to.

For buyers:
- search and browse used car parts;
- add a vehicle and focus results on parts that fit it;
- review compatibility information before checkout;
- save parts and searches;
- contact sellers through marketplace messaging;
- use protected marketplace payment flows;
- track orders, delivery and transaction cases;
- leave transaction-linked reviews and fit feedback when eligible.

For sellers:
- create a seller profile;
- add and manage listings and images;
- import larger inventories by CSV;
- add vehicle compatibility information;
- receive and manage marketplace orders;
- connect a Stripe payout account;
- respond to Find My Part requests and buyer enquiries.

SecondPart is designed for used and reusable vehicle parts. Availability, compatibility evidence, delivery options and seller coverage vary by listing and seller. Always review the listing details and compatibility information before purchasing.

## 2. Production URLs to enter in Play Console

Replace `<production-domain>` only after the final stable HTTPS origin is configured and smoke-tested.

- Privacy policy: `https://<production-domain>/privacy`
- Account deletion web resource: `https://<production-domain>/account-deletion`
- Support/contact: `https://<production-domain>/contact`

Do not submit Preview/Vercel preview URLs as permanent Play policy URLs.

Production must also configure a real monitored `NEXT_PUBLIC_SUPPORT_EMAIL`. The same validated address is rendered on `/contact` and `/privacy` without requiring sign-in. Do not put a placeholder mailbox into the Play listing.

The Production AAB workflow runs `scripts/verify-production-origin.mjs` before `bundleRelease`. The build is intentionally blocked unless the canonical Production origin serves the SecondPart homepage, Privacy Policy, public Contact page, external account-deletion resource and a valid Android App Links association.

## 3. Android signing and App Links

SecondPart uses two different signing identities and they must not be confused. See `docs/android-signing-app-links.md` for the full runbook.

### Upload key
The SecondPart upload key signs the `.aab` before upload to Google Play. The Production workflow derives its SHA-256 certificate fingerprint and later verifies that the generated AAB is signed by the same upload certificate.

### Google Play App Signing certificate(s)
When Play App Signing is enabled, Google Play signs the APKs installed on users' devices. The live `/.well-known/assetlinks.json` must therefore contain the Google Play app-signing SHA-256 certificate fingerprint(s), not merely the SecondPart upload-key fingerprint.

Required release configuration:
- Production web environment: `ANDROID_APP_LINK_SHA256_FINGERPRINTS` — every Google Play app-signing fingerprint required for domain/API association;
- GitHub Actions secret: `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS` — the matching expected set used by the live-origin verifier;
- GitHub upload-key secrets remain separate and are used only for AAB signing/verification.

The origin verifier accepts more than one Play app-signing fingerprint and requires every expected fingerprint to be present in the live Digital Asset Links statement.

## 4. App content declarations

### Privacy policy
Expected: **Yes / required**.

Evidence:
- public `/privacy` route;
- privacy route also available from the app;
- final production URL must be publicly reachable without a reviewer account;
- the real monitored support/privacy email must be visible on the Production page.

### Account creation and deletion
Expected:
- account creation: **Yes**;
- in-app deletion path: **Yes**, Account > Security & account;
- external deletion path: **Yes**, `/account-deletion`;
- data-retention exceptions: disclose only legitimate retained categories/reasons described by the final Privacy Policy and `docs/account-data-retention.md`.

Release evidence still required: destructive deletion E2E using a disposable QA account and `docs/account-deletion-e2e-runbook.md`.

### Ads declaration
Current-code expected answer: **No**.

Reason: no advertising SDK or in-app third-party ad placement is identified in the current production dependencies/native plugin set. Re-check the final AAB/dependencies before submission. If advertising or sponsored placements are added later, revisit this declaration before publishing that update.

### App access
Expected: **Some functionality is restricted by sign-in**, therefore provide Play reviewers with access instructions.

Create two dedicated reusable reviewer accounts in the production environment:
1. reviewer buyer account;
2. reviewer seller account with seller profile already created.

Do **not** commit usernames/passwords to GitHub. Store them only in the Play Console App access form and the approved internal credential store.

Suggested reviewer path:
- open app;
- sign in using the buyer demo account;
- browse Home/Search and open a listing;
- open Garage / vehicle selection;
- open saved/account areas;
- sign out;
- sign in using the seller demo account;
- switch/use Seller mode;
- open Seller Dashboard, Listings, Payments and Orders.

If checkout cannot safely be exercised by a Play reviewer without creating a real charge/order, say so clearly in reviewer notes and ensure the rest of the restricted functionality remains reviewable.

### Target audience and content
Proposed product position: **18+ only**.

Rationale: SecondPart is a transactional automotive marketplace with seller onboarding, buyer/seller contracts and payment/refund/dispute flows. It is not designed for children.

This is a product/legal declaration, not a code-derived fact. Confirm the final selection in Play Console before submission and do not select child age groups unless the product is deliberately redesigned to comply with Families requirements.

### Content rating
Complete the current Play/IARC questionnaire from the final product behaviour. Relevant product characteristics to answer accurately include:
- user-generated listings, photos and descriptions;
- buyer/seller messaging;
- reviews and fit feedback;
- report/block/moderation controls;
- marketplace commerce;
- no gambling/adult-content functionality designed into the product.

Do not guess the final rating in this document; retain the Play-generated rating as release evidence.

### News app declaration
Expected: **No**.

SecondPart's primary purpose is an automotive parts marketplace. A future editorial/product-updates section does not by itself make the app a news application. Revisit only if news becomes a primary app purpose.

## 5. Data Safety

Use `docs/google-play-data-safety-draft.md` as the working inventory, then re-check it against:
- exact production AAB/native plugins;
- `android-release-permissions.txt` generated from the merged Release manifest;
- production Supabase configuration;
- Stripe production behaviour;
- Firebase/FCM;
- Vercel/monitoring logs;
- any vehicle-data provider enabled at release.

Do not infer `Collected` versus `Shared` from ordinary language; use Google's current Data Safety definitions and each provider's actual contractual role.

## 6. Reviewer instructions template

Copy this structure into Play Console only after production reviewer accounts exist:

**Access required:** Yes.

**Buyer account:** credentials supplied privately in Play Console.

**Seller account:** credentials supplied privately in Play Console.

**How to review buyer features:**
1. Sign in with the buyer account.
2. Home and Search show marketplace listings.
3. Garage lets the reviewer add/select a vehicle and use compatibility filtering.
4. Listing pages show compatibility state and seller information.
5. Account exposes saved items/searches, orders and Security & account.
6. Account deletion is under Security & account.

**How to review seller features:**
1. Sign out and sign in with the seller reviewer account.
2. Open Seller mode / Seller Dashboard.
3. Review seller profile, listings, inventory/import, orders and payout setup surfaces.
4. Do not enter or replace real payout credentials unless explicitly required by the review flow.

**Payments:** explain the exact safe reviewer path used by the production release. Never place Stripe secret/test card details in reviewer notes unless Play explicitly requires a supported test credential and the environment is intentionally configured for it.

## 7. Store graphics

### Native branding — complete
- versioned source: `assets/android-production/logo.svg`;
- launcher/adaptive icon and splash generated by `@capacitor/assets`;
- production-style AAB pipeline verifies generated resources;
- Android Release Pipeline Check passed on 2026-09-10.

### Play listing graphics — still required
- 512×512 PNG store icon;
- 1024×500 feature graphic;
- required phone screenshots from the final RC;
- optional additional device screenshots only if they accurately represent supported devices.

Store screenshots must come from the final release-candidate UI rather than old Preview screens.

## 8. Release evidence checklist

Before pressing Submit for review, retain evidence that:
- production domain is stable and policy URLs work without login;
- Production origin preflight passes before the real AAB build;
- real `NEXT_PUBLIC_SUPPORT_EMAIL` is configured, monitored and visible on `/contact` and `/privacy`;
- permanent upload key is configured and backed up securely;
- Play App Signing is configured for `com.secondpart.marketplace`;
- every Google Play app-signing SHA-256 fingerprint required for domain/API association is present in live `/.well-known/assetlinks.json`;
- the Production web fingerprint set and GitHub expected Play-signing fingerprint set match;
- production Firebase Android app matches `com.secondpart.marketplace`;
- final production AAB workflow succeeds;
- AAB package/version/upload signature are correct;
- AAB SHA-256 and upload signer SHA-256 are recorded in `android-release-evidence.json` / `.txt`;
- merged Release permissions are retained in `android-release-permissions.txt`;
- exact Production AAB targets API 36 and passes the current Google Play native-code / 16 KB page-size compatibility check;
- test-track install succeeds on a physical Android device;
- the complete P0 physical-device matrix in `docs/android-rc-test-matrix.md` passes;
- sign-up/sign-in/logout/recovery works;
- buyer and seller modes work;
- camera/image upload works;
- App Links work from a Google Play test-track installation, not only a locally signed build;
- network loss/recovery is acceptable;
- FCM notification E2E passes;
- Stripe sandbox happy-path plus the verified full-refund/released-payout-reversal path remain green, and the still-open adverse checkout/retry/provider-race scenarios in `docs/commerce-e2e-runbook.md` are completed before public commerce;
- the `seller_checkout_ready` anonymous EXECUTE revoke remains deployed/read-back in the authorised release database (`anon=false`, `authenticated=true`, `service_role=true`), and any later least-privilege grant changes are likewise verified before money-flow sign-off;
- destructive account-deletion QA passes using `docs/account-deletion-e2e-runbook.md`;
- Production critical alerts have a real destination;
- `/admin/system/alerts` returns a successful HTTP 2xx smoke result and the fixed smoke alert is visibly confirmed in the intended operations destination;
- legal/privacy/support identity and wording are final;
- Data Safety/App content answers match the exact release.

## 9. Current external blockers

These cannot be represented as complete merely by committing code:
- final contracting/developer identity for Production, currently waiting on the planned UK Ltd incorporation and downstream business setup;
- stable production domain/origin;
- permanent Google Play upload key and production signing secrets;
- Play Console Organisation app creation / developer-account verification / Play App Signing configuration and its final app-signing SHA-256 fingerprint set;
- Production `ANDROID_APP_LINK_SHA256_FINGERPRINTS` and GitHub `ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS` configuration;
- production Firebase `google-services.json` secret;
- final Vercel production environment access;
- real monitored public support/privacy mailbox;
- real Production critical-alert destination and successful smoke alert;
- controlled Supabase Auth confirmation/recovery email-template wiring to `TokenHash`, followed by a fresh legitimate confirmation lifecycle;
- destructive account-deletion E2E using a fresh disposable confirmed account;
- Supabase Pro+ plan/configuration if leaked-password protection remains a launch gate; the current organisation is Free;
- physical-device/test-track QA using `docs/android-rc-test-matrix.md`;
- truthful checkout-ready provider fixture for decline/abandon/retry and full provider/UI last-stock race;
- natural 48-hour release observation if retained as release evidence;
- reviewer/demo account creation and Play Console manual declarations;
- real marketplace seller supply/liquidity.

## Release protocols in this repository

- `docs/android-signing-app-links.md` — upload-key versus Play App Signing roles, required fingerprint configuration and Production origin gate.
- `docs/android-rc-test-matrix.md` — physical Android RC PASS/FAIL matrix and GO/NO-GO evidence.
- `docs/commerce-e2e-runbook.md` — real Stripe test-mode happy path, protection, refund, dispute/reversal and stock-concurrency scenarios.
- `docs/account-deletion-e2e-runbook.md` — destructive privacy/deletion test on disposable accounts only.
- `docs/operations-monitoring.md` — production monitoring and critical-alert smoke-test procedure.
- `docs/account-data-retention.md` — deletion/retention rules for identity, transaction and evidential records.

## Official Play references to re-check on submission day

- Play Console App content / review preparation: https://support.google.com/googleplay/android-developer/answer/9859455
- User data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Target audience/content: https://support.google.com/googleplay/android-developer/answer/9867159
- Content rating requirements: https://support.google.com/googleplay/android-developer/answer/9859655
- Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- 16 KB page-size compatibility: https://developer.android.com/guide/practices/page-sizes
