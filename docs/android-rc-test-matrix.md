# SecondPart Android Release Candidate Test Matrix

Snapshot: 2026-09-10
Branch: `rebuild-nextjs`
Production package: `com.secondpart.marketplace`

This document is the physical-device release gate for the first real Google Play Release Candidate. A green GitHub Actions build is necessary but does **not** complete this gate.

## Execution rules

Run these tests against the exact AAB uploaded to a Google Play Internal or Closed testing track.

For every test record:

- RC version name and version code;
- Git commit SHA used to build the AAB;
- Google Play test-track name;
- physical device model;
- Android version;
- tester;
- date/time;
- result: `PASS`, `FAIL`, or `BLOCKED`;
- evidence reference: screenshot, short screen recording, log/reference ID, or Stripe/Firebase test object where relevant;
- defect/commit reference for any fixed failure.

Do not record secrets, test card details, full delivery addresses or other unnecessary personal data in release evidence.

A test cannot be marked PASS because the screen merely opened. The expected behaviour below must be observed.

## Release gate rule

Release candidate status is `GO` only when:

1. every P0 test below is `PASS`;
2. there are no unresolved crash/data-loss/security/payment defects;
3. FCM delivery is proven on a physical device;
4. the real Stripe test-mode commerce scenarios are separately signed off using `docs/commerce-e2e-runbook.md`;
5. the exact package/version/signature matches the production release record.

A `BLOCKED` P0 is a release blocker, not a conditional pass.

---

## A. Install, identity and lifecycle

### RC-INSTALL-01 — Fresh install

Priority: P0

Steps:
1. Install the RC from the Google Play test track on a device where SecondPart Production is not installed.
2. Launch from the Play-installed launcher icon.

PASS when:
- package installs without sideloading;
- app launches successfully;
- package is `com.secondpart.marketplace`;
- correct SecondPart launcher/adaptive icon is visible;
- splash/launch branding is correct;
- no Preview branding or Preview package is used.

### RC-INSTALL-02 — Update in place

Priority: P0

Steps:
1. Install the previous test-track Production build.
2. Update to the current RC through Google Play.

PASS when:
- update installs over the previous package;
- user/session data is not unexpectedly lost;
- app launches after update;
- no duplicate Production icon/package appears.

### RC-LIFE-01 — Background/resume

Priority: P0

PASS when:
- backgrounding and resuming from Home, listing detail, Garage, Inbox and Account does not reset navigation unexpectedly;
- session remains valid when expected;
- stale screens refresh safely when required.

### RC-LIFE-02 — Android hardware Back

Priority: P0

PASS when:
- nested routes return to the previous logical screen;
- root navigation does not loop or jump unpredictably;
- Back from a root screen follows Android-appropriate behaviour rather than corrupting navigation state.

---

## B. Authentication and account safety

### RC-AUTH-01 — Buyer sign-up and confirmation

Priority: P0

PASS when:
- buyer account can be created through the normal UI;
- current Terms/Privacy acceptance is required;
- confirmation flow returns safely to SecondPart;
- confirmed account can sign in.

### RC-AUTH-02 — Seller sign-up / selling mode

Priority: P0

PASS when:
- seller path is visible and understandable;
- seller can still use buyer features;
- seller account/dashboard loads without separate incompatible identity state.

### RC-AUTH-03 — Sign-out and sign-in

Priority: P0

PASS when:
- sign-out removes the active authenticated session from the app;
- protected screens do not remain usable from stale state;
- signing in again restores the correct account.

### RC-AUTH-04 — Password recovery

Priority: P0

PASS when:
- password recovery email can be requested;
- recovery link returns to the correct Production flow;
- password can be changed;
- old password no longer authenticates after successful reset.

### RC-PRIVACY-01 — Account deletion entry points

Priority: P0

PASS when:
- Account > Security exposes account deletion;
- external account-deletion page opens from the Production origin;
- wording does not imply instant deletion when operational/legal blockers may apply.

The destructive backend deletion E2E is a separate release gate and must use a disposable QA account.

---

## C. Core navigation and marketplace

### RC-NAV-01 — Bottom/root navigation latency and correctness

Priority: P0

Sequence:
`Home -> Garage -> Inbox -> Account -> Home -> Account -> Inbox -> Garage -> Home`

PASS when:
- each tap acknowledges immediately;
- no wrong screen flashes over the selected tab;
- right-to-left navigation is as stable as left-to-right navigation;
- no persistent loading dead-end occurs;
- repeated rapid navigation does not leave the wrong active tab.

### RC-HOME-01 — Marketplace first load

Priority: P0

PASS when:
- Home loads marketplace cards;
- images/thumbnails render without layout collapse;
- scrolling remains responsive;
- pagination/load-more does not duplicate or skip obvious items.

### RC-SEARCH-01 — Search and filters

Priority: P0

PASS when:
- keyword search returns controlled results;
- changing/removing filters updates results correctly;
- zero-result state is understandable and exposes the intended fallback where applicable.

### RC-LISTING-01 — Listing detail

Priority: P0

PASS when:
- title, price, seller, condition, delivery/collection and compatibility information render correctly;
- gallery opens without broken images;
- save/unsave behaves consistently;
- seller/contact/report controls route correctly.

---

## D. Garage and vehicle compatibility

### RC-GARAGE-01 — Add a new vehicle

Priority: P0

PASS when:
- Add vehicle begins a clean new selection;
- a previously selected vehicle is not incorrectly pre-filled as the new vehicle;
- saved vehicle appears in Garage after completion.

### RC-GARAGE-02 — Vehicle checkbox consistency

Priority: P0

PASS when:
- `Show only parts that fit this vehicle` is visible beside/with the selected vehicle where designed;
- checked state restricts results to compatible items;
- unchecked state returns to broader marketplace results;
- behaviour is consistent between Garage and Home.

### RC-GARAGE-03 — Change/remove vehicle

Priority: P0

PASS when:
- user can switch selected vehicle;
- remove operation does not leave stale compatibility state;
- marketplace reflects the current selection after navigation/resume.

### RC-COMPAT-01 — Compatibility warning

Priority: P0

PASS when:
- exact/verified fit can proceed normally;
- family-match/unverified compatibility displays the intended warning;
- incompatible/unknown state cannot silently bypass server-side compatibility protection where checkout validation applies.

Manual vehicle selection is the RC fallback while registration lookup credentials are not production-ready.

---

## E. Buyer tools, messaging and UGC safety

### RC-BUYER-01 — Saved parts and saved searches

Priority: P0

PASS when:
- save/unsave persists after route changes and app resume;
- saved search can be created/removed;
- stale UI does not re-add a removed item after refresh.

### RC-MSG-01 — Pre-purchase conversation

Priority: P0

PASS when:
- buyer can open a listing conversation with an eligible seller;
- message sends once;
- conversation appears in Inbox;
- blocked-user and Terms controls prevent messaging when expected.

### RC-UGC-01 — Report and block

Priority: P0

PASS when:
- listing/user can be reported through the intended UI;
- user can be blocked/unblocked;
- blocked pre-purchase messaging is actually unavailable, not just visually hidden.

### RC-REQUEST-01 — Find My Part

Priority: P0

PASS when:
- user can create a request through the intended flow;
- validation/Terms gate works;
- request is visible in the buyer experience after creation;
- image/note fields behave correctly if used.

---

## F. Seller flows

### RC-SELLER-01 — Seller profile/readiness

Priority: P0

PASS when:
- seller profile loads;
- editable business/profile fields save correctly;
- changing identity-sensitive seller fields does not retain an invalid verification state;
- readiness state explains blockers rather than silently failing.

### RC-SELLER-02 — Create listing

Priority: P0

PASS when:
- required fields validate;
- listing can be created with the intended condition/category/price/stock data;
- compatibility evidence can be added where required;
- draft/publish state is understandable.

### RC-SELLER-03 — Edit and publish listing

Priority: P0

PASS when:
- edits persist after navigation and reload;
- publish action respects readiness/Terms/evidence gates;
- active listing appears correctly in the marketplace.

### RC-MEDIA-01 — Gallery upload

Priority: P0

PASS when:
- seller can select a supported image from the device;
- compression/upload completes;
- resulting listing image renders correctly;
- unsupported/oversized/bad input receives a controlled error.

### RC-MEDIA-02 — Camera capture

Priority: P0

PASS when:
- permission flow is understandable;
- capture returns to the listing flow;
- image uploads successfully;
- denying permission does not crash or dead-end the app.

### RC-IMPORT-01 — Seller CSV import

Priority: P1 for first RC unless bulk onboarding is required for the launch cohort; P0 before high-volume seller rollout.

PASS when:
- preview/report step works;
- invalid rows are explained;
- valid rows import without UI freeze;
- large import path remains chunked.

---

## G. Payments and commerce shell

These tests verify the physical Android surface. Money-state correctness is signed off separately in `docs/commerce-e2e-runbook.md`.

### RC-STRIPE-01 — Buyer checkout launch/return

Priority: P0

PASS when:
- checkout launches through the expected Stripe-hosted path;
- cancelling returns safely to SecondPart;
- successful Stripe test payment returns to the correct order flow;
- Android UI cannot mark the order paid without server confirmation.

### RC-STRIPE-02 — Seller Stripe onboarding launch/return

Priority: P0 before real seller payouts

PASS when:
- onboarding launches for the intended QA seller;
- returning to SecondPart refreshes seller payment readiness;
- repeated onboarding start does not create uncontrolled duplicate recipient accounts.

### RC-ORDER-01 — Purchases and order timeline

Priority: P0

PASS when:
- paid QA order appears for the buyer;
- timeline/statuses match server state;
- buyer receipt/accept controls appear only in valid states;
- repeated taps do not duplicate state transitions.

### RC-SALES-01 — Seller fulfilment

Priority: P0

PASS when:
- seller can open the sale;
- allowed fulfilment transition can be completed;
- dispatch/tracking evidence persists;
- buyer sees the corresponding controlled state.

### RC-CASE-01 — Return/dispute entry point

Priority: P0

PASS when:
- eligible buyer can open the appropriate case flow;
- case/evidence upload works;
- active case is visible in the transaction experience;
- payout UI does not imply money is safely releasable while a blocking case exists.

---

## H. Push notifications

### RC-FCM-01 — Permission and token registration

Priority: P0

PASS when:
- notification permission is requested only through the intended opt-in flow;
- allowing permission registers the physical device;
- sign-out detaches/deactivates the user-device association as designed.

### RC-FCM-02 — Foreground notification

Priority: P0

PASS when:
- a real FCM test notification generated through the SecondPart server path reaches the device while the app is foregrounded;
- notification/in-app state refreshes correctly.

### RC-FCM-03 — Background notification and tap routing

Priority: P0

PASS when:
- notification reaches the device in background;
- tapping opens the intended SecondPart destination;
- protected destinations require/restore authentication correctly.

### RC-FCM-04 — Invalid/stale token behaviour

Priority: P1 for device UI, P0 for backend release readiness.

PASS when backend handling deactivates an invalid token without failing the whole notification batch.

---

## I. Links and external return paths

### RC-LINK-01 — Verified HTTPS App Link

Priority: P0

PASS when:
- supported Production HTTPS link opens SecondPart on the physical device from an external surface;
- link resolves to the intended in-app route;
- browser fallback remains safe if app-link verification is unavailable.

### RC-LINK-02 — Auth completion link

Priority: P0

PASS when:
- confirmation/recovery completion returns to a valid Production route;
- PKCE/callback handling is not intercepted prematurely.

### RC-LINK-03 — Stripe completion return

Priority: P0

PASS when:
- checkout and seller-onboarding returns resolve to the correct SecondPart route after the hosted provider flow.

---

## J. Network failure and resilience

### RC-NET-01 — Launch offline

Priority: P0

PASS when:
- app does not crash;
- user receives a controlled loading/error/retry state;
- reconnecting allows recovery without reinstalling or clearing app data.

### RC-NET-02 — Network loss during navigation

Priority: P0

PASS when:
- cached/root navigation does not corrupt account state;
- failed request is represented safely;
- retry/recovery does not duplicate mutations.

### RC-NET-03 — Network loss during image upload

Priority: P0

PASS when:
- upload failure is explicit;
- listing form remains recoverable;
- retry does not create duplicated image records.

### RC-NET-04 — Network loss around checkout return

Priority: P0

PASS when:
- client does not invent payment success;
- returning online reconciles against server/provider truth.

---

## K. Visual and accessibility sanity

### RC-VISUAL-01 — Launcher/adaptive icon

Priority: P0

PASS when the SecondPart mark remains legible on the physical launcher's supported icon mask and does not show a Capacitor placeholder.

### RC-VISUAL-02 — Splash/launch transition

Priority: P0

PASS when launch branding is correct and transition into the hosted frontend does not produce an obvious white/unstyled flash that looks like a crash.

### RC-VISUAL-03 — Critical layouts

Priority: P0

Check Home, Garage, listing detail, Inbox, Account, seller listing editor and checkout return on the target phone.

PASS when:
- no clipped primary actions;
- no overlapping bottom navigation;
- no persistent horizontal overflow;
- keyboard does not make required form actions unreachable.

---

## Release evidence template

```text
RC version: 
Version code: 
Commit SHA: 
Play track: 
Device: 
Android: 
Tester: 
Date/time: 

Test ID: 
Result: PASS / FAIL / BLOCKED
Evidence: 
Observed behaviour: 
Defect reference (if any): 
Fix commit (if any): 
Retest result: 
```

## RC sign-off summary

```text
P0 total:
P0 PASS:
P0 FAIL:
P0 BLOCKED:
P1 open:

Commerce E2E signed off: YES / NO
Physical FCM E2E signed off: YES / NO
Destructive deletion QA signed off: YES / NO
Production package/signature verified: YES / NO
Critical alerts smoke-tested: YES / NO

Decision: GO / NO-GO
Approved by:
Date:
```
