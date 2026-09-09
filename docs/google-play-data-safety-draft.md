# Google Play Data Safety — SecondPart Draft

Snapshot: 2026-09-09
Package: `com.secondpart.marketplace`

This is a Play Console preparation draft based on the current SecondPart architecture. It is not a legal opinion and must be rechecked against the production build, final SDK list and provider agreements before submission.

## High-level Play answers

- App supports account creation: **Yes**
- In-app account deletion/request path: **Yes** — Account > Security & account
- External account deletion/request path: **Yes** — `/account-deletion`
- Privacy policy: **Yes** — `/privacy`
- Data encrypted in transit: **Yes for intended production traffic** — production frontend/API and provider traffic use HTTPS.
- User can request deletion: **Yes**
- Independent security review / MASA-style validation: **Not currently claimed**
- Ads SDK / behavioural ad network: **None identified in current dependencies**
- Device GPS permission used for marketplace distance: **No** — current distance is postcode-based.

## Data likely collected / processed off device

### Personal info
- Name / display name
- Email address
- Phone number when provided
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

### Approximate location / address-related data
- Postcodes used for seller/garage location and distance
- Delivery address information for transactions where applicable
- Vehicle registration can indirectly relate to a user/vehicle and should be covered in privacy disclosures

Important:
- Current marketplace distance does not require precise device location/GPS.
- Re-check the Play Console location category against the exact production flows.

### Financial / purchase data
SecondPart does not intentionally store raw card numbers. Stripe handles card payment processing.

SecondPart does process/store marketplace state such as:
- Order and purchase history
- Payment status
- Payment-provider transaction/session references
- Refund/dispute state
- Seller payout/onboarding state
- Marketplace fees / seller net amounts

Play Console classification must be checked carefully against the current Data Safety definitions for financial info and purchase history.

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
- Part request notes
- Seller/listing descriptions and user-generated marketplace content

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
- Android push notification token / device registration record
- Authentication/session-related identifiers handled by Supabase
- Provider/session identifiers required for payment and security flows

### Diagnostics / technical data
The production stack may inherently create infrastructure request/error logs through hosting and service providers. A dedicated third-party crash analytics SDK is not currently identified in the repository.

Before submission, verify exactly what Vercel, Supabase, Firebase/FCM and any newly added monitoring tooling record from the production Android/web sessions.

## Production service providers currently represented in the architecture

- Supabase — authentication, database, storage
- Stripe — card payment / marketplace payment state / seller payout onboarding
- Firebase Cloud Messaging — Android push notifications
- Vercel — web application hosting/delivery
- Approved vehicle-data provider — only after final vehicle lookup approval/configuration

## "Collected" vs "Shared"

Google Play uses policy-specific definitions. Do not mark a provider integration as "shared" or "not shared" solely from normal-language interpretation.

Before final submission:
1. Review each provider's current Google Play / privacy guidance.
2. Confirm whether the provider acts as a service provider processing data on SecondPart's behalf.
3. Confirm whether any provider uses the data for its own purposes beyond providing the contracted service.
4. Ensure the Data Safety answers and Privacy Policy match.

## Account deletion

Current UI:
- In app: `/account/security`
- External web: `/account-deletion`

Current backend:
- creates an `account_deletion_requests` record
- allows a pending request to be cancelled

P0 before public release:
- define retention rules
- implement operational deletion/anonymisation
- ensure completion actually removes associated user data except records retained for a documented legitimate/legal reason
- document retained data and retention reason in Privacy Policy

## Items to verify immediately before Play submission

- Final production dependencies and Android plugins
- Final Android permissions from the generated release manifest
- Production Firebase configuration
- Whether a crash/error monitoring provider was added
- Stripe production flow and exact data sent/received
- Production vehicle lookup provider and terms
- Final retention schedule
- Final privacy contact and contracting/developer identity
- Whether all transmitted data types are represented in this document
- Whether any SDK performs collection unrelated to the user-facing feature
