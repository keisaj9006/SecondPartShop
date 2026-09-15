# SecondPart monitoring and diagnosis evidence — 2026-09-15

## Scope

Engineering/runtime verification only on `rebuild-nextjs` and Vercel Preview. No real external alert was sent and no improvised recipient/destination was configured.

## Structured monitoring contract

`src/lib/ops-monitoring.ts` provides bounded structured records with component/event/release/environment context and sanitizes:

- full URLs down to origin/path (query strings removed);
- email addresses;
- UUIDs;
- Stripe/Supabase secrets and webhook secrets;
- JWTs;
- Stripe publishable/secret/restricted keys;
- Bearer credentials;
- error stack/context values to bounded lengths.

Critical alerts are HTTPS-only, time-bounded, and return an explicit delivery result: `delivered`, `not_configured`, `invalid_url`, `http_error`, or `network_error`. Alert-provider failure is logged as a bounded sanitized warning rather than converted into a false success.

The full clean CI at code boundary `03b62cfb0747cda006d6c0158097b80fcf2f459a` passed `test-monitoring-redaction.mjs` and `validate:monitoring` together with the entire integrated test suite and build.

## CSV diagnostic boundary

`test-csv-import-diagnostics.mjs` confirms seller CSV reference-lookup failure emits a stable operational event/code (`seller_csv_reference_lookup_failed`, `reference_lookup`, `CSV_REF_LOOKUP_FAILED`, `CSV-REF-LOOKUP-01`) while deliberately excluding filename, registrations, seller references, CSV contents or row payloads from monitoring context.

The user-visible import path remains fail-closed with the existing bounded message `Existing seller references could not be checked.` rather than guessing a provider/database cause.

## Preview runtime observation

Vercel Preview runtime logs were queried for the previous 24 hours:

- `level=error`: no matching runtime logs;
- full-text `SECOND_PART_OPS`: no matching runtime logs.

This is an observation of that window only, not a claim that runtime errors can never occur.

## Alert-delivery boundary

A prior Preview environment preflight found no configured `OPS_ALERT_WEBHOOK_URL`. No new real alert destination has been supplied in this QA session, and the current tool boundary does not expose secret environment values for safe reconfiguration/receipt confirmation.

Therefore real alert receipt is **EXTERNAL / UNSIGNED**, not PASS. The code and test suite explicitly preserve this distinction: absence or delivery failure returns a non-delivered status.

## Classification

- **VERIFIED:** sanitization/redaction, bounded structured diagnostics, privacy-safe CSV diagnostic coding, fail-closed delivery status, clean Preview runtime observation.
- **EXTERNAL / UNSIGNED:** actual receipt at an approved operational alert destination. A real test destination must be configured and observed before this gate can be signed off.
