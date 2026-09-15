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

## Status

**CONFIGURED / RECEIPT PENDING.**

A fresh Preview deployment is required after the environment-variable change. The gate is not VERIFIED until the admin smoke action returns delivered/HTTP success and the message is visibly present in the real `#secondpart-alerts` destination.
