# RC-05 final integration and Commerce B-H checkpoint — 2026-10-28

## Decision

- Migration identity: **PASS** in disposable Supabase/PostgreSQL 17.11.
- PR #28: **READY at the database-change scope, pending final integrated CI and independent review**.
- Commerce B-H: **BLOCKED as full E2E**. Safe local application/SQL evidence passed, but this checkpoint did not mutate the SecondPart Stripe Sandbox or a shared hosted Supabase project. Therefore no scenario is relabelled full UI + Stripe + database PASS.
- SecondPart 1.0: **NO-GO for public launch**. This checkpoint closes the RC-05 identity blocker, not provider, physical-device, security-operations, legal or liquidity gates.

No Production, `main`, Stripe Live, hosted schema/ledger, hosted order/payment, Storage object, user account or Google Play public track changed.

## Checkpoint A — exact migration identity

The exact candidate `20261014202700_review_ready_notifications_forward.sql` was applied with Supabase CLI 2.122.0 to a disposable local Supabase Docker stack after the 207-unit canonical schema replay. PostgreSQL reported 17.11. The task-only directory first reproduced all 207 hosted version/name identities and held the candidate outside startup migrations. After staging, `migration up` applied only the candidate, the ledger changed exactly 207 to 208, and final `migration list` matched all 208 local/remote versions. The candidate ledger readback contained exactly one row:

| Field | Observed |
| --- | --- |
| version | `20261014202700` |
| name | `review_ready_notifications_forward` |
| LF source SHA-256 | `e6dd184f94748c5a7f6ec6ba9012ab534599d2f69099c23af12f2e542f1246aa` |
| parsed statement count | 6 |
| parsed statements SHA-256 | `87d416c7b7b56686f9c0c799cbf6012c2dc0a6041f770b18d84359c10388b2fe` |
| function / triggers | 1 / 2 |

A deliberate changed-SQL/same-version probe was skipped by the CLI (`applied: []`). The added repository validator therefore recomputes and pins the raw parsed statement array, source and statement fingerprints, full 207-entry baseline identity hash, exact 207 to 208 delta, added identity and zero pending migrations after application. The canonical 207-unit replay manifest is independently pinned by SHA-256 rather than count alone.

Fresh hosted read-only observation still reports 207 rows, head `20261008130523`, the five-function repair identity exactly once, and the candidate version/name zero times. No hosted operation was attempted.

## Checkpoint B — Commerce B-H evidence

Read-only Stripe inspection selected the explicitly named `SecondPart sandbox` account `acct_1UEUN72RWsyIBCbK`, `livemode=false`. Webhook `we_1UEa0q2RWsyIBCbKwy45jivt` is enabled at the Internal QA Preview origin with exactly seven required Checkout, failed-payment and dispute events. No Stripe object or setting was created, updated, resent or deleted.

Fresh local evidence:

- 244/244 application, adapter and reduced-SQL tests passed for checkout cancellation/provider ordering, buyer receipt idempotency, refund authority/idempotency, payout retry/recovery, dispute ordering/reversal recovery, webhook isolation, Connect/test-mode fail-closed behavior and the isolated-provider runner guards.
- Native PostgreSQL 17.11 last-stock race used two independent sessions: exactly one checkout won; final stock 0, one reserved order/item and one reservation event.
- Native PostgreSQL 17.11 dispute/reversal race used three connections: exactly one provider-operation claim won; both contradictory terminal interleavings were rejected. No provider call was made.
- The two task-only database containers and their anonymous volumes were removed after the run.

| Scenario | Database/application evidence | Fresh UI evidence | Fresh Stripe evidence | Result |
| --- | --- | --- | --- | --- |
| B — Buyer Protection timer | receipt window and active-case guards PASS | not run in an isolated deployed app | read-only only | BLOCKED |
| C — silent buyer | current policy/source retained; no clock-advanced full fixture in this run | not run | read-only only | BLOCKED |
| D — cancellation | cancellation/provider-ordering/idempotency tests PASS | not run | no new Session/refund | BLOCKED |
| E — return/refund | refund correlation, authority and repeat safety PASS | not run | no new Refund; historical September evidence retained only | BLOCKED |
| F — dispute/reversal | PG17 claim/terminal serialization and SQL recovery PASS | not run | no new dispute/transfer/reversal | BLOCKED |
| G — competing checkout | native PG17 two-session final-stock race PASS | not run | no linked Checkout Sessions | BLOCKED |
| H — decline then retry | retry safety, webhook isolation and provider guards PASS | not run | no new failed/successful PaymentIntent | BLOCKED |

The missing boundary is one isolated application deployment tied to an isolated Supabase database, local synthetic Auth buyer/seller identities and explicitly approved test-only Stripe writes. The smallest approval scope is: test-mode only on `acct_1UEUN72RWsyIBCbK`; uniquely tagged disposable objects; values capped at GBP 5; no customer data or raw card data; no Live access; no real payout; normal webhook/application paths; retained sanitized object IDs; and an explicit cleanup/reconciliation record. Any temporary webhook/tunnel or disposable Connect account must be named in that approval before creation.

## Checkpoint C — release register delta

| Gate | Current status | Remaining evidence |
| --- | --- | --- |
| Buyer UAT | BLOCKED | exact-SHA signed-in browser/Android journeys, checkout, cases and recovery |
| Seller UAT | BLOCKED | exact-SHA listing lifecycle, inventory, fulfilment, return and payout journeys |
| Admin UAT | BLOCKED | exact-SHA cases, refunds, disputes, payout recovery and audit views |
| Auth/account deletion | BLOCKED | disposable real Auth identity, mailbox/session lifecycle and destructive E2E |
| Security | BLOCKED | leaked-password protection and explicit SECURITY DEFINER RPC allowlist/operations sign-off |
| Performance | PARTIAL | existing static/isolated evidence retained; physical WebView and representative production-load evidence remain |
| Android physical QA | BLOCKED | final Internal AAB 44-scenario device matrix, FCM, camera/gallery, App Links and checkout returns |

These statuses reuse current evidence and do not repeat previously passed RC-03/RC-04 or 66/66 suites.

## Commands and cleanup

- `npm run validate:rc05-migration-identity` — PASS.
- `node --test scripts/test-rc05-migration-identity.mjs` — 3/3 PASS.
- Focused Commerce command described above — 244/244 PASS.
- `verify-last-stock-concurrency-postgres.mjs` — PASS on PostgreSQL 17.11.
- `verify-dispute-reversal-concurrency-postgres.mjs` — PASS on PostgreSQL 17.11.

Final lint, typecheck, build, release validators, diff check and independent review are recorded on the final commit rather than inferred here.
