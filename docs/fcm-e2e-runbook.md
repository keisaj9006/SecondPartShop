# SecondPart Physical FCM E2E Runbook

Snapshot: 2026-09-10
Branch: `rebuild-nextjs`
Production package: `com.secondpart.marketplace`

This runbook is the release evidence procedure for Android push notifications. It must be executed on a physical device using the exact Release Candidate installed from Google Play Internal or Closed testing.

A successful Firebase/FCM HTTP response, a `sent` row in `mobile_push_outbox`, or a green CI build is **not** a physical-device PASS. The notification must actually reach the phone and the expected in-app behaviour must be observed.

## 1. Preconditions

Before starting:

- use the exact AAB/RC intended for the Play test track;
- record RC version name, version code and Git commit SHA;
- verify the installed package is `com.secondpart.marketplace`;
- sign in through the normal SecondPart UI with a disposable QA account;
- Firebase server credentials must be configured in the tested environment;
- notification permission must be requested and granted through the normal app flow;
- the phone must register itself through the normal `/api/mobile/v1/push-devices` path;
- the device must appear as enabled in `/admin/system/push-test`;
- do **not** paste, seed, copy, screenshot or otherwise expose the FCM token.

If the device does not appear in the admin smoke-test page, stop and record the test as `BLOCKED`. Do not create a device row manually.

## 2. RC-FCM-01 — Permission and registration

1. Start with the QA account signed in on the physical RC.
2. Reach the normal notification opt-in flow.
3. Grant Android notification permission.
4. Confirm the device appears in `/admin/system/push-test` as an enabled registration.
5. Sign out and confirm the app follows its intended device/session cleanup behaviour.
6. Sign in again and confirm notification registration can be restored without creating uncontrolled duplicate registrations.

PASS when permission handling is understandable, the real device registers through the application path, and no manual token manipulation is required.

## 3. RC-FCM-02 — Foreground delivery

1. Keep SecondPart open in the foreground on the QA phone.
2. Open `/admin/system/push-test` as an admin.
3. Choose the QA device and select **Queue fixed smoke test**.
4. Refresh the smoke-test status until the server pipeline reports its final state.
5. Observe the physical phone.
6. Confirm the hosted application refreshes its notification state after `pushNotificationReceived` without a crash or navigation reset.
7. Open Notifications and confirm the `SecondPart notification test` entry exists.

PASS requires both the server path and physical application behaviour to succeed. A server-side `sent` state alone is insufficient.

## 4. RC-FCM-03 — Background delivery and tap routing

1. Put SecondPart in the background without signing out.
2. Queue a new fixed smoke test from `/admin/system/push-test`.
3. Confirm the Android notification is delivered to the physical device.
4. Tap the notification.
5. Confirm SecondPart comes to the foreground and opens the intended internal `/notifications` destination.
6. Confirm no browser/external URL is opened and no wrong root tab flashes or remains selected.
7. Confirm the authenticated session is handled normally. If the session is no longer valid, the protected destination must fall back to the normal authentication flow rather than exposing account content.

PASS when physical delivery and tap routing both work on the RC.

## 5. Cold-start tap check

This is required before public release even if the operating system/device makes it difficult to reproduce consistently.

1. Remove SecondPart from recents / terminate the app using the normal Android test procedure.
2. Queue another fixed smoke notification.
3. Wait for the physical notification.
4. Tap it from the system tray.
5. Confirm the Production app starts without a crash and reaches the intended protected notifications flow.

Record `PASS`, `FAIL`, or `BLOCKED` with the exact device/OS behaviour. Do not infer a pass from the background test.

## 6. RC-FCM-04 — Stale/invalid-token backend handling

This backend safety test must prove that one invalid registration does not fail the whole notification batch.

Use only a disposable QA device/account and an approved test procedure. Do not alter a real user's token.

PASS when:

- FCM identifies the stale/unregistered target;
- SecondPart marks/deactivates that device according to the existing invalid-token handling;
- other valid outbox deliveries can continue;
- the failed target does not remain in an uncontrolled infinite retry loop.

## 7. Security checks

During the run:

- the admin page must never display FCM tokens;
- the smoke form must not accept arbitrary title, body or target URL;
- the test must insert a normal `notifications` row and rely on the production notification trigger/outbox/dispatcher path;
- the smoke tool must not directly invoke the low-level FCM sender;
- push tap routing must accept only safe same-origin internal paths supplied by the server notification payload;
- `//host`, external origins and malformed paths must not be navigated to.

## 8. Evidence template

```text
RC version:
Version code:
Commit SHA:
Play track:
Device:
Android:
Tester:
Date/time:

RC-FCM-01 Permission/registration: PASS / FAIL / BLOCKED
Evidence:

RC-FCM-02 Foreground: PASS / FAIL / BLOCKED
Server outbox status:
Physical observation:
Evidence:

RC-FCM-03 Background + tap routing: PASS / FAIL / BLOCKED
Server outbox status:
Physical observation:
Destination opened:
Evidence:

Cold-start tap: PASS / FAIL / BLOCKED
Evidence:

RC-FCM-04 Stale token backend: PASS / FAIL / BLOCKED
Evidence/reference:

Defects found:
Fix commit(s):
Retest result:
```

Do not include FCM tokens, Firebase credentials, access tokens, private keys, test card details, full addresses or other unnecessary personal information in the evidence.

## 9. Release decision

Physical FCM is `GO` only when:

- RC-FCM-01 is PASS;
- RC-FCM-02 is PASS;
- RC-FCM-03 is PASS;
- cold-start tap is PASS;
- backend invalid-token handling is verified;
- no unresolved crash, authentication bypass, external-navigation or notification-routing defect remains.

Until those conditions are met, the Google Play release checklist must keep physical FCM E2E open.
