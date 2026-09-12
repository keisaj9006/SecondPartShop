# SecondPart Operations Monitoring

This runbook defines the launch baseline for production error and commerce-flow monitoring on `rebuild-nextjs`.

## What is monitored

SecondPart emits structured `SECOND_PART_OPS` server logs for failure classes that can materially affect marketplace operation:

- uncaught Next.js server/request errors;
- browser runtime errors and React error-boundary crashes;
- web and Android checkout setup failures;
- checkout reservation rollback failures;
- Stripe webhook processing failures;
- Stripe reconciliation failures;
- payout release and payout rollback failures;
- push-notification dispatch failures/retries;
- account-deletion processor failures/retries;
- commerce/privacy maintenance failures.

Each event carries a stable `component` and `event` value so incidents can be grouped without depending on free-text exception messages.

## Severity

- `warning` — degraded/retried work where the user transaction is not known to be lost, for example a reconciliation or push retry.
- `error` — a failed operation that should be investigated but has a controlled fallback.
- `critical` — payment, payout, webhook, reservation rollback, destructive privacy processing or uncaught server failures that can affect money, stock or account integrity.

Critical events can also be forwarded to an external HTTPS webhook. Runtime alert forwarding remains best-effort so a temporary alert-provider problem must never block checkout, webhook acknowledgement or maintenance.

For release verification, however, SecondPart has a separate **verifiable smoke-test path** that reports whether the configured destination accepted the fixed test alert with HTTP 2xx.

## Alert environment variables

```bash
OPS_ALERT_WEBHOOK_URL=
# generic | slack | discord
OPS_ALERT_WEBHOOK_KIND=generic
# Optional Bearer token for a protected generic webhook.
OPS_ALERT_WEBHOOK_TOKEN=
```

Never expose these values through `NEXT_PUBLIC_*` variables and never copy the webhook URL/token into screenshots or release evidence.

Only HTTPS webhook URLs are accepted by the sender.

## Critical alert smoke test

Admin route:

```text
/admin/system/alerts
```

The page is protected by `requireAdmin()` and does not display the webhook URL or bearer token.

The **Send critical alert smoke test** action sends only a fixed privacy-safe payload:

- severity: `critical`;
- component: `commerce_maintenance`;
- event: `manual_alert_smoke_test`;
- fixed SecondPart smoke-test message;
- no browser-supplied arbitrary alert body, webhook URL or token.

Possible outcomes:

- `Delivered` — configured HTTPS destination returned HTTP 2xx;
- `Failed / http_error` — destination returned a non-2xx HTTP response;
- `Failed / network_error` — request failed/timed out;
- `Failed / invalid_url` — configured destination is malformed or not HTTPS;
- `Failed / not_configured` — `OPS_ALERT_WEBHOOK_URL` is missing.

A HTTP 2xx response proves the destination accepted the request, but the release P0 is not complete until the tester also confirms that the smoke-test message is visible in the real operations destination.

### Evidence to retain

Record only:

- Production release/commit SHA;
- test timestamp;
- destination adapter type (`generic`, `slack` or `discord`);
- smoke-test result and HTTP status when available;
- confirmation that the alert appeared in the expected operations destination.

Do not record the webhook URL, bearer token, secrets or unrelated alert contents.

## Privacy rules

Monitoring must not become a second analytics/customer-data store.

The logger sanitises common email addresses, UUID-like identifiers, bearer/API tokens and URL query strings before emitting records. Browser error ingestion stores only a salted hash of the request fingerprint for abuse-rate limiting; raw IP addresses and user-agent strings are not persisted in the monitoring table.

The browser telemetry endpoint is same-origin only, payload-bounded and protected by a service-role-only PostgreSQL rate limiter. The limiter state is pruned automatically by commerce maintenance.

## Vercel investigation workflow

For a production incident, inspect runtime errors/logs first and filter for:

```text
SECOND_PART_OPS
```

Then narrow by `component` / `event`, especially:

```text
checkout / checkout_setup_failed
checkout / checkout_reservation_rollback_failed
stripe_webhook / stripe_webhook_processing_failed
payout / payout_release_batch_failed
payout / payout_rollback_deferred
account_deletion / deletion_queue_failed
commerce_maintenance / commerce_maintenance_failed
```

The release SHA is included when Vercel exposes `VERCEL_GIT_COMMIT_SHA`, which allows the incident to be tied back to the exact deployed commit.

## Incident priority

1. **Money/stock integrity first:** checkout rollback, webhook, payout and dispute failures.
2. **Account/privacy integrity:** account deletion/destructive cleanup failures.
3. **Availability:** uncaught API/server errors and repeated client crashes.
4. **Delivery degradation:** push/reconciliation retry volume.

Never manually force a payout or mutate an order to silence an alert. Reconcile provider/database state first and use the existing controlled commerce paths.

## Release gate

Production monitoring is code-ready when:

- normal QA is green;
- the browser telemetry limiter migration is applied with RLS enabled;
- `anon` and `authenticated` cannot read the limiter table or call its service-only RPCs;
- checkout/webhook/payout/privacy critical paths emit structured events;
- non-2xx webhook responses are treated as failed delivery rather than silently accepted;
- `/admin/system/alerts` is admin-only and sends a fixed smoke-test payload;
- Production can configure a webhook destination without changing application code.

The **external monitoring P0** is complete only after Production `OPS_ALERT_WEBHOOK_URL` is configured and the admin smoke test returns HTTP 2xx **and** the alert is visibly confirmed in the intended operations destination.

## Credential redaction regression checks

`node --test scripts/test-monitoring-redaction.mjs` exercises the actual reporting and marketplace-analytics boundaries with synthetic credentials, captured console output and mocked alert transport. It does not send a real alert. Coverage includes signing secrets, Supabase secret keys, standalone JWT claim fragments at truncation boundaries and Stripe intent client secrets, together with the existing URL/email/API-key/Bearer redaction. Context keys and values are sanitized. Safe provider object IDs, status and error codes remain useful for correlation.

Do not test this by pasting a real credential into a failing request or log. New provider credential formats require a synthetic regression case; these tests do not replace separately authorized alert-delivery verification.
