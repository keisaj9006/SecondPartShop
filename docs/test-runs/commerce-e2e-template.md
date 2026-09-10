# SecondPart Commerce E2E Evidence Template

Use this file only as a copy/template for a **real Stripe test-mode execution** of `docs/commerce-e2e-runbook.md`.

This template by itself is not release evidence and is not a PASS. Do not mark a scenario complete until the normal buyer, seller, Stripe webhook, maintenance and verifier paths have actually been exercised.

## Safety rules

- Environment must report **Stripe test mode** in `/admin/commerce/e2e` before any QA payment is started.
- Never use `sk_live_` / `rk_live_` credentials for release QA.
- Do not record Stripe secret keys, webhook secrets, service-role keys, passwords, test card numbers/CVCs or full personal addresses.
- Do not manually edit order/payment/payout/stock states to make a scenario pass.
- Record provider object identifiers only when they are useful for tracing the test (`cs_test_`, `pi_`, `ch_`, `tr_`, `re_`, dispute IDs).

## Run identity

```text
Date/time (Europe/London):
Environment / origin:
Application commit SHA:
Surface: Web / Android RC
Tester:
Stripe API mode shown by preflight: TEST / OTHER
Stripe webhook signing shown by preflight: READY / BLOCKED
HTTPS origin shown by preflight: READY / BLOCKED
Commerce preflight overall: READY / BLOCKED
```

## Scenario result

```text
Scenario: A / B / C / D / E / F / G
Result: PASS / FAIL / BLOCKED / NOT RUN

Order ID:
Order item ID:
QA seller ID/reference:
QA buyer ID/reference:
Listing ID:

Checkout Session ID:
PaymentIntent ID:
Charge ID:
Transfer ID:
Refund ID:
Dispute ID:
Transfer reversal ID:

Verifier stage:
Verifier PASS count:
Verifier PENDING count:
Verifier FAIL count:

Payment event persisted: YES / NO / N/A
Order audit event persisted: YES / NO / N/A
Dispatch/collection evidence persisted: YES / NO / N/A
Buyer receipt evidence persisted: YES / NO / N/A
Buyer Protection release time correct: YES / NO / N/A
Active case blocks payout: YES / NO / N/A
Released payout has provider transfer evidence: YES / NO / N/A
Stock restored exactly once when expected: YES / NO / N/A
Duplicate webhook remains idempotent: YES / NO / N/A

Evidence references:
Observed defect/blocker:
Fix commit:
Retest result:
```

## Minimum evidence by scenario

### A — Happy path / explicit acceptance

- Genuine Stripe test Checkout completed through the normal buyer flow.
- `checkout_paid` payment event and `payment_confirmed` order event persisted.
- Seller dispatch performed through normal seller UI.
- Buyer used **Accept item** through normal buyer UI.
- Normal maintenance/release path produced a Stripe test transfer.
- Verifier reports `0 fail`, stage `completed`, `provider_transfer_id` and `funds_released_at`.

### B — Buyer Protection timer

- Buyer used **Received**, not **Accept item**.
- `buyer_received_at` and `delivered_at` persisted.
- Payout scheduled with future `release_eligible_at`.
- Maintenance before eligibility did not release funds.
- No payout release occurred while an active case existed.

### C — Silent buyer / unverified delivery

- Dispatch occurred normally.
- Buyer remained silent.
- Silence alone did not schedule or release payout.
- Controlled QA evidence demonstrates review-gate behaviour without falsifying Production timestamps.
- Admin review starts the normal Buyer Protection window rather than immediate payout.

### D — Cancellation / refund

- Cancellation followed a normal product path.
- Provider refund evidence persisted when capture had occurred.
- Stock/listing availability restored exactly once.
- Payout never released for the cancelled item.
- Duplicate provider/reconciliation delivery did not duplicate refund or stock restoration.

### E — Return / transaction case

- Buyer opened the case through the normal UI.
- Case appears in Admin Commerce.
- Active case blocks payout.
- Seller response and case history remain auditable.
- Refund and transfer-reversal evidence is persisted when applicable.

### F — Stripe dispute / reversal

- Stripe test dispute event was delivered through the normal webhook path.
- Provider dispute is linked to the transaction case.
- Payout is blocked or enters controlled reversal recovery as appropriate.
- Duplicate/closure events remain idempotent.

### G — Competing checkout / last stock

- Listing stock started at `1`.
- Two independent buyer sessions attempted checkout competitively.
- Exactly one reservation succeeded.
- Losing attempt received a controlled stock/reservation conflict.
- Stock never became negative.
- Expiry/cancellation restored availability at most once.

## Release sign-off

```text
Scenario A PASS: YES / NO
Scenario B PASS: YES / NO
Scenario C evidence acceptable: YES / NO / DEFERRED TO CONTROLLED QA
Scenario D PASS: YES / NO
Scenario E PASS: YES / NO
Scenario F PASS: YES / NO
Scenario G PASS: YES / NO

No live-money credentials used: YES / NO
No manual database state forcing used: YES / NO
No sensitive secrets/card data retained in evidence: YES / NO

Commerce E2E P0 overall: PASS / FAIL / BLOCKED
Sign-off note:
```
