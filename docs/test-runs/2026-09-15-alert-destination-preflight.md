# SecondPart alert destination preflight — 2026-09-15

## Scope

This note records the Preview alert-destination configuration before the real smoke receipt is executed.

No Production environment was changed. No webhook URL or secret value is recorded here.

## Configuration performed by the project owner

In Vercel for project `second-part-shop`, Preview-only environment variables were configured:

- `OPS_ALERT_WEBHOOK_URL` — stored as a Secret and pointed to the dedicated Discord webhook for `#secondpart-alerts`;
- `OPS_ALERT_WEBHOOK_KIND=discord` — stored for Preview only;
- `OPS_ALERT_WEBHOOK_TOKEN` — intentionally unset because Discord webhooks do not require a bearer token.

The Discord webhook is named `SecondPart Alerts` and targets the dedicated `#secondpart-alerts` channel.

## Application boundary

The existing alert implementation is unchanged:

- `sendCriticalAlertSmokeTest()` sends a fixed, privacy-safe critical record;
- Discord payloads use the `content` field;
- webhook URLs must use HTTPS;
- the browser never supplies arbitrary alert content or webhook credentials;
- the smoke action is protected by `requireAdmin('/admin/system/alerts')`.

## Diagnostic smoke attempt

A first Preview smoke attempt reached the configured HTTPS destination but returned `HTTP 400`. The admin page reported adapter `generic`, and Vercel runtime logs recorded `SECOND_PART_ALERT_DELIVERY_FAILED HTTP 400` for `manual_alert_smoke_test` on Preview release `a23ea5338614`.

Root cause: `OPS_ALERT_WEBHOOK_URL` was present, but `OPS_ALERT_WEBHOOK_KIND` had not actually been persisted in Vercel. The project owner then added `OPS_ALERT_WEBHOOK_KIND=discord` as a Preview-only Config variable. No Production variable was added.

A fresh Preview deployment is now required so the corrected environment configuration is loaded before retrying the smoke test.

## Status

**CONFIGURED / RECEIPT PENDING.**

The gate is not VERIFIED until the admin smoke action returns delivered/HTTP success and the message is visibly present in the real `#secondpart-alerts` destination.
