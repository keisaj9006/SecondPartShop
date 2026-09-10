# SecondPart — Google Play Release Pack

Snapshot: 2026-09-10
Package: `com.secondpart.marketplace`
Status: pre-submission working pack; re-check against the exact production AAB and Play Console forms on submission day.

This document keeps the Google Play release answers consistent. Credentials, signing secrets, Firebase files, Stripe secrets and personal verification documents must never be committed here.

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

## 3. App content declarations

### Privacy policy
Expected: **Yes / required**.

Evidence:
- public `/privacy` route;
- privacy route also available from the app;
- final production URL must be publicly reachable without a reviewer account.

### Account creation and deletion
Expected:
- account creation: **Yes**;
- in-app deletion path: **Yes**, Account > Security & account;
- external deletion path: **Yes**, `/account-deletion`;
- data-retention exceptions: disclose only legitimate retained categories/reasons described by the final Privacy Policy and `docs/account-data-retention.md`.

Release evidence still required: destructive deletion E2E using a disposable QA account.

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

## 4. Data Safety

Use `docs/google-play-data-safety-draft.md` as the working inventory, then re-check it against:
- exact production AAB/native plugins;
- merged Android permissions;
- production Supabase configuration;
- Stripe production behaviour;
- Firebase/FCM;
- Vercel/monitoring logs;
- any vehicle-data provider enabled at release.

Do not infer `Collected` versus `Shared` from ordinary language; use Google's current Data Safety definitions and each provider's actual contractual role.

## 5. Reviewer instructions template

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

## 6. Store graphics

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

## 7. Release evidence checklist

Before pressing Submit for review, retain evidence that:
- production domain is stable and policy URLs work without login;
- permanent upload key is configured and backed up securely;
- production Firebase Android app matches `com.secondpart.marketplace`;
- final production AAB workflow succeeds;
- AAB package/version/signature are correct;
- test-track install succeeds on a physical Android device;
- sign-up/sign-in/logout/recovery works;
- buyer and seller modes work;
- camera/image upload works;
- deep links/app links work;
- network loss/recovery is acceptable;
- FCM notification E2E passes;
- real Stripe test-mode commerce E2E and edge cases have passed before public commerce;
- destructive account-deletion QA passes;
- production critical alerts have a real destination and a successful smoke alert;
- legal/privacy/support identity and wording are final;
- Data Safety/App content answers match the exact release.

## 8. Current external blockers

These cannot be represented as complete merely by committing code:
- stable production domain/origin;
- permanent Google Play upload key and production signing secrets;
- production Firebase `google-services.json` secret;
- final Vercel production environment/alert destination access;
- current Supabase connector permission needed to deploy/verify the pending payout-recovery migration;
- Play Console developer/account verification and manual declarations;
- physical-device/test-track QA;
- real test transactions and reviewer/demo account creation.

## Official Play references to re-check on submission day

- Play Console App content / review preparation: https://support.google.com/googleplay/android-developer/answer/9859455
- User data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Target audience/content: https://support.google.com/googleplay/android-developer/answer/9867159
- Content rating requirements: https://support.google.com/googleplay/android-developer/answer/9859655
