# Google Play Data Safety — SecondPart Draft

Snapshot: 2026-09-10
Package: `com.secondpart.marketplace`

This is a Play Console preparation draft based on the current SecondPart architecture. It is not a legal opinion and must be rechecked against the exact production AAB, final SDK list, production provider configuration and provider agreements immediately before submission.

## High-level Play answers

- App supports account creation: **Yes**
- In-app account deletion path: **Yes** — Account > Security & account
- External account deletion web path: **Yes** — `/account-deletion`
- Privacy policy: **Yes** — `/privacy`
- Data encrypted in transit: **Yes for intended production traffic** — production frontend/API and provider traffic are required to use HTTPS.
- User can request account deletion and associated-data deletion: **Yes**
- Independent security review / MASA-style validation: **Not claimed**
- Ads SDK / behavioural ad network: **None identified in the current application dependencies**
- Device GPS permission used for marketplace distance: **No** — current distance is postcode-based and location permissions are release-blocked.
- Dedicated third-party crash analytics SDK: **None identified** — SecondPart currently uses its own privacy-safe structured operations monitoring plus provider infrastructure logs.

## Release-manifest permission evidence

Google Play Data Safety answers must be checked against the **merged Release AndroidManifest generated for the exact AAB**, not only against source code or expected plugin behaviour.

SecondPart now enforces this in both Android release pipelines:

- `scripts/verify-android-release-manifest.mjs` inspects Gradle's generated Release manifest after `bundleRelease`;
- `docs/android-permission-policy.md` defines sensitive permission families that are blocked for the current product;
- the verifier requires the hosted application network permission and fails on unexpected sensitive permissions such as GPS/location, microphone, SMS, contacts, call history, body sensors, broad package inventory or unrestricted external-storage management;
- the real Production workflow stores `android-release-permissions.txt` beside the signed AAB artifact.

Before completing Play Data Safety, review that permission report from the **same Production workflow run** as the submitted AAB. A green permission audit is evidence about Android permissions; it does not by itself answer whether data is collected/shared by server-side services.

## Data likely collected / processed off device

### Personal info

- Name / display name
- Email address
- Phone number when voluntarily provided or required by a marketplace flow
- User IDs / account identifiers
- Seller/business identity and business profile information
- Delivery / transaction contact information where required by order fulfilment

Purposes:
- Account management
- Marketplace transactions
- Seller verification
- Buyer/seller communication
- Fraud/security
- Support

### Location / address-related data

- Postcodes/outcodes used for seller/garage location and distance
- Delivery address information for transactions where applicable
- Vehicle registration can indirectly relate to a user/vehicle and is treated as personal transaction/vehicle data in SecondPart retention rules

Important:
- Current marketplace distance does not request device GPS or precise device location.
- Android Release blocks fine/coarse/background location permissions unless the product policy is deliberately changed.
- Google Play location disclosures must still be checked against the exact production data flow and current Play definitions rather than inferred only from Android permissions.

### Financial / purchase data

SecondPart does not intentionally store raw payment-card numbers. Stripe handles card-payment collection and seller payment onboarding.

SecondPart does process/store marketplace state such as:
- Order and purchase history
- Payment status
- Payment-provider checkout/payment/charge references
- Refund/dispute state
- Seller payout/onboarding state
- Marketplace fees / seller net amounts
- Seller transfer/reversal references

Play Console classification must be checked carefully against the current Data Safety definitions for financial information and purchase history.

### Photos and files

- Part listing photos
- Transaction/case evidence uploaded by users where enabled

Purposes:
- Marketplace listings
- Buyer/seller evidence
- Returns/disputes/safety

### Messages / user-generated content

- Listing questions
- Transaction messages
- Support requests
- Find My Part / part-request notes
- Seller/listing descriptions and other marketplace UGC

SecondPart also provides report/block/moderation controls and Terms-gates relevant UGC paths.

### App activity

- Saved parts
- Saved searches
- Recently viewed listings
- Marketplace search analytics
- Find My Part activity
- Notification state

Purposes:
- Core product functionality
- Personalisation
- Marketplace operations
- Product analytics / reliability

### Device or other identifiers

- Android FCM push token / device registration record
- Authentication/session-related identifiers handled by Supabase
- Provider/session identifiers required for payment, fraud prevention and security flows

### Diagnostics / technical data

SecondPart has privacy-safe structured operations monitoring for server/client failures and critical checkout, Stripe webhook, payout, reconciliation, push, deletion and maintenance paths. Hosting/database/push/payment providers may also create infrastructure request/error logs as part of service delivery.

Before submission, verify exactly what Vercel, Supabase, Firebase/FCM, Stripe and any subsequently added production tooling record from Android/web sessions and how those records map to the current Play Data Safety definitions.

## Production service providers represented in the architecture

- Supabase — authentication, database, storage
- Stripe — card payment / marketplace payment state / seller payout onboarding and transfers
- Firebase Cloud Messaging — Android push notifications
- Vercel — web application hosting/delivery
- Approved vehicle-data provider — only after final vehicle lookup approval/configuration

## "Collected" vs "Shared"

Google Play uses policy-specific definitions. Do not mark a provider integration as "shared" or "not shared" solely from normal-language interpretation.

Before final submission:
1. Review each provider's current Google Play / privacy guidance and the production agreement.
2. Confirm whether the provider acts as a service provider processing data on SecondPart's behalf.
3. Confirm whether any provider uses data for its own purposes beyond providing the contracted service.
4. Ensure the Data Safety answers and Privacy Policy describe the same production behaviour.

## Account deletion — current implementation

User-facing paths:
- In app: `/account/security`
- External web: `/account-deletion`

Current backend is no longer a request-only freeze. It has an operational deletion/anonymisation processor with:
- a controlled deletion request and processing queue;
- blockers for unresolved buyer/seller commerce, transaction cases, Buy + Fit workflows and moderation cases;
- seller/listing freeze before destructive processing;
- tracked listing-image storage cleanup;
- PII cleanup and identity detachment from records that must remain for legitimate accounting, dispute, fraud-prevention or legal reasons;
- hard Supabase Auth user deletion;
- retry-safe processing and a non-identifying completion audit;
- a documented retention matrix in `docs/account-data-retention.md`.

Important release evidence still required:
- run destructive account-deletion E2E on a disposable QA account using `docs/account-deletion-e2e-runbook.md`;
- confirm the external deletion URL works from the final production origin without login;
- confirm the Privacy Policy clearly explains categories retained for legitimate/legal reasons and retention logic.

Google Play requires apps that create accounts to provide both an in-app deletion path and an external web resource. Account freezing alone is not sufficient; associated user data must be deleted except where retention is legitimately required and disclosed.

## Security practices — evidence before answering Play

Do not claim security properties only because the code intends them. Before Play submission verify from the release candidate:
- production uses HTTPS only;
- production WebView debugging/logging are disabled;
- secrets are server-side and absent from the AAB/web client;
- RLS/service-role boundaries are applied to the production Supabase project;
- payout/deletion/admin RPC grants match migrations;
- production FCM and Stripe credentials are isolated from Preview/test configuration;
- the exact submitted AAB's `android-release-permissions.txt` contains no release-blocked sensitive permission.

## Items to verify immediately before Play submission

- Final production AAB dependencies and native plugins
- `android-release-permissions.txt` from the exact submitted Production AAB workflow
- Final Android target API level
- Production Firebase configuration
- Exact structured monitoring/logging destinations and retention
- Stripe production flow and exact data sent/received
- Production vehicle lookup provider and terms, if enabled
- Final retention schedule and destructive deletion QA evidence
- Final privacy/support contact and contracting/developer identity
- Whether all transmitted data types are represented in this document
- Whether any SDK performs collection unrelated to the user-facing feature
- Current Play Data Safety definitions and policy changes effective on the submission date
