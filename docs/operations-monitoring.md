# SecondPart Operations Monitoring

This runbook defines the launch baseline for production error and commerce-flow monitoring on `rebuild-nextjs`.

## What is monitored

SecondPart emits structured `SECOND_PART_OPS` server logs for the failure classes that can materially affect marketplace operation:

- uncaught Next.js server/request errors
- browser runtime errors and React error-boundary crashes
- web and Android checkout setup failures
- checkout reservation rollback failures
- Stripe webhook processing failures
- Stripe reconciliation failures
- payout release and payout rollback failures
- push-notification dispatch failures/retries
- account-deletion processor failures/retries
- commerce/privacy maintenance failures

Each event carries a stable `component` and `event` value so incidents can be grouped without depending on free-text exception messages.

## Severity

- `warning` — degraded/retried work where the user transaction is not known to be lost, for example a reconciliation or push retry.
- `error` — a failed operation that should be investigated but has a controlled fallback.
- `critical` — payment, payout, webhook, reservation rollback, destructive privacy processing or uncaught server failures that can affect money, stock or account integrity.

Critical events may also be forwarded to an external HTTPS webhook. Alert delivery is deliberately best-effort and must never block checkout, webhook acknowledgement or maintenance.

## Optional alert environment variables

```bash
# Optional. Structured logs work without these values.
OPS_ALERT_WEBHOOK_URL=
# generic | slack | discord
OPS_ALERT_WEBHOOK_KIND=generic
# Optional Bearer token for a generic protected webhook.
OPS_ALERT_WEBHOOK_TOKEN=
```

Never expose these values through `NEXT_PUBLIC_*` variables.

## Privacy rules

Monitoring must not become a second analytics/customer-data store.

The logger therefore sanitises common email addresses, UUID-like identifiers, bearer/API tokens and URL query strings before emitting records. Browser error ingestion stores only a salted hash of the request fingerprint for abuse-rate limiting; raw IP addresses and user-agent strings are not persisted in the monitoring table.

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

Never manually force a payout or mutate an order to silence an alert. Reconcile the provider/database state first and use the existing controlled commerce RPCs.

## Release gate

Production monitoring is considered code-ready when:

- normal QA (`lint`, `typecheck`, notification validation, mobile-performance validation, launch-baseline and build) is green;
- the browser telemetry limiter migration is applied with RLS enabled;
- `anon` and `authenticated` cannot read the limiter table or call its service-only RPCs;
- checkout/webhook/payout/privacy critical paths emit structured events;
- a production environment can optionally configure a webhook destination without changing application code.

External alert delivery should be smoke-tested once the final production Vercel environment and alert destination are configured.
