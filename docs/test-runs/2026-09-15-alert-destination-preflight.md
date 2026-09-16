# SecondPart alert destination evidence — 2026-09-15/16

## Scope

This note records the Preview critical-alert destination setup, diagnostic failures, timeout fix and final real receipt verification.

No Production environment was changed. No webhook URL or secret value is recorded here.

## Preview configuration

In Vercel for project `second-part-shop`, Preview-only environment variables are configured:

- `OPS_ALERT_WEBHOOK_URL` — stored as a Secret and pointed to the dedicated Discord webhook for `#secondpart-alerts`;
- `OPS_ALERT_WEBHOOK_KIND=discord` — stored as Preview-only Config;
- `OPS_ALERT_WEBHOOK_TOKEN` — intentionally unset because Discord webhooks do not require a bearer token.

The Discord webhook is named `SecondPart Alerts` and targets `#secondpart-alerts`.

## Application boundary

The smoke path remains admin-only:

- `sendCriticalAlertSmokeTest()` sends a fixed, privacy-safe critical record;
- Discord payloads use the `content` field;
- webhook URLs must use HTTPS;
- browser input cannot supply arbitrary alert content, webhook URLs or tokens;
- `/admin/system/alerts` and the smoke action are protected by `requireAdmin`.

## Diagnostic attempt 1 — missing Discord adapter

A first Preview smoke attempt returned `HTTP 400` while the admin page showed adapter `generic`. Vercel runtime logs recorded `SECOND_PART_ALERT_DELIVERY_FAILED HTTP 400` for `manual_alert_smoke_test` on Preview release `a23ea5338614`.

Root cause: `OPS_ALERT_WEBHOOK_URL` existed, but `OPS_ALERT_WEBHOOK_KIND` had not actually been persisted in Vercel. The owner then added `OPS_ALERT_WEBHOOK_KIND=discord` for Preview only. Production remained untouched.

## Diagnostic attempt 2 — false-negative timeout

After a fresh Preview deployment with adapter `discord`, Discord visibly received the smoke alert in `#secondpart-alerts`, but the admin UI reported `network_error`.

Vercel runtime logs for Preview release `f0d6e053e99d` showed:

`SECOND_PART_ALERT_DELIVERY_FAILED AbortError: This operation was aborted`

The sender timeout was 1500 ms. The external destination had already accepted and published the message, but SecondPart aborted while waiting for the HTTP response and therefore produced a false-negative result.

A TDD regression was added first:

- RED commit: `c58f41faf07d942332fe5ecc4ac1d286420fa388`
- GitHub Actions: `35069406923`
- result: `npm test` failed on the new timeout regression while lint/typecheck and the independent concurrency/scale jobs remained healthy.

The minimal production fix then increased the alert delivery timeout from 1500 ms to 5000 ms via `ALERT_DELIVERY_TIMEOUT_MS`:

- GREEN commit: `fd9c94b7b7e6ed858b4cdc5588771035c9f257fd`
- GitHub Actions: `35069547432`
- overall conclusion: **success**
- lint: PASS
- typecheck: PASS
- full test suite: PASS
- all release validators: PASS
- production build: PASS
- last-stock concurrency: PASS
- isolated 100k marketplace PostgreSQL proof: PASS

## Final real receipt verification

Exact Preview deployment:

- deployment: `dpl_5DPspNijcuSQ1v1ttYkyjpFfCJtW`
- SHA: `fd9c94b7b7e6ed858b4cdc5588771035c9f257fd`
- state: READY
- environment: Preview

The authenticated admin smoke page showed:

- destination configured;
- adapter `discord`;
- `Destination accepted the smoke alert`;
- result `delivered`;
- `HTTP 204`.

The corresponding SecondPart smoke message was visibly present in the real Discord `#secondpart-alerts` channel.

Vercel runtime logs for the exact deployment recorded the `manual_alert_smoke_test` event on release `fd9c94b7b7e6` and no `SECOND_PART_ALERT_DELIVERY_FAILED` line for the successful request.

This gives UI + application + provider HTTP + real destination receipt evidence.

## Temporary admin cleanup

The QA seller profile used to access the admin-only smoke page was temporarily promoted only for this test. After verification it was reverted through the guarded service-role path.

Final hosted readback:

- profile id `cf2ef681-9ced-4fb8-9a50-efd5668138b0`
- role `seller`

No other profile role was modified.

## Final classification

**VERIFIED — Preview critical alert destination receipt.**

The Discord alert gate is closed for the observed Preview boundary. Production alert configuration remains a separate launch-environment concern and was not changed by this test.
