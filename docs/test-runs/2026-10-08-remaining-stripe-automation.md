# Remaining Stripe automation — 2026-10-08

The safe automated Stripe scope is exhausted for the currently available credentials. **12 distinct actual isolated-provider checkpoints passed**, including two declines followed by success on the same PaymentIntent, creation idempotency, provider session closure/expiry, and one successful refund after same-key replays. Connect creation and dispute reads are blocked by the anonymous Sandbox credential scope. These checkpoint counts do not mean 12 of the 15 marketplace release scenarios are complete.

Source boundary: `codex/final-rc-hardening`, source freeze `55b4afbf6e762cbd4f2346da2dab1e8345124766`, draft PR #17. Later documentation commits are tracked by root. This specialist did not merge, deploy Production, change existing Stripe settings, or mutate shared hosted fixtures.

## Isolation and provider evidence

The connector initially exposed exactly one account: **SecondPart sandbox** `acct_1UEUN72RWsyIBCbK`, livemode false. Read-only inspection confirmed webhook `we_1UEa0q2RWsyIBCbKwy45jivt` targets the Preview commerce route and subscribes to Checkout/failure/dispute events. Current source unconditionally scheduled global push dispatch even for unrelated events, so generating these events on that shared Sandbox was unsafe under the owner's no-global-worker boundary. No writes, replays, endpoint changes or settings changes were made there. Earlier genuine app/Sandbox happy-path and return/refund/reversal evidence remains in `2026-09-21-sandbox-checkout.md` and `2026-09-15-provider-refund-reversal-e2e.md`; it is historical evidence, not a fresh run.

Official Stripe CLI 1.53.1 created a separate anonymous claimable Sandbox **`acct_1UOKMWKAOBtWLkgp`** using a synthetic invalid-domain identity and a private task-specific TEMP profile. CLI identity showed test-mode key available and live-mode key unavailable. No owner email, customer identity, real card data, account login, subscription, bank payout or Live credential was used. Only official test PaymentMethod identifiers were submitted; raw card payloads are rejected. This is the [Stripe CLI anonymous Sandbox workflow](https://docs.stripe.com/cli/sandbox).

One nonfinancial, uniquely tagged Product established positive API `livemode=false`: `prod_VP9RBYWEgVkE3T`. Before every subsequent POST, the runner rechecked the same account's test-only CLI identity, complete zero-webhook inventory, and freshly retrieved tagged Product mode anchor. Final read-only inventory still had zero endpoints and no pagination. Objects contain no SecondPart order/item UUIDs, buyer/seller/customer IDs, or customer contact data. These provider events therefore had no connection to the shared app. Private credentials, claim URLs and raw provider diagnostics remain outside repository evidence.

| Actual provider checkpoint | Safe object ID / outcome |
| --- | --- |
| Tagged test-mode Product and zero endpoint preflight | `prod_VP9RBYWEgVkE3T`, livemode false |
| Fresh unpaid PaymentIntent | `pi_3UOL8yKAOBtWLkgp1MlGs2Bs`, GBP 5.00, requires_payment_method |
| First decline | Same PI, card_declined / generic_decline, amount_received 0 |
| Retry declined again | Same PI, card_declined / generic_decline, amount_received 0 |
| Successful retry | Same PI, succeeded, amount_received 500, charge `ch_3UOL8yKAOBtWLkgp1CofhpS6` |
| PaymentIntent creation idempotency | Repeating original creation key returned the same PI |
| Cancelled Checkout provider close | `cs_test_a1QlMx3PCjN0tcu7AJzmGXHSUcA6251mf95JGz3nI5YYxuAn9SzSnFovA1`, expired/unpaid |
| Explicit Checkout expiry | `cs_test_a1vzT2ipX87l00kRrAm0EVd0pB8k9IMTz7z9XSmfwhoqKiHOAkuU5dt60r`, expired/unpaid |
| Checkout creation idempotency | Same creation key returned `cs_test_a1t4qCPdT7hldxZ4LgYCYNuXR9IDWqCzKSkl6gggD6COtJNBf8cyL9shSD` |
| Duplicate-created session final closure | That same session expired/unpaid; repeating expiry key remained expired |
| Refund idempotency | `re_3UOL8yKAOBtWLkgp1JTwacyC`, succeeded, GBP 5.00; exact original refund key replayed twice, provider refund list count exactly 1 |
| Dispute-test source payment | `pi_3UOLEuKAOBtWLkgp1uQIiCeN`, succeeded GBP 5.00, charge `ch_3UOLEuKAOBtWLkgp1BLJqS5o`; dispute lifecycle itself not observable with this key |

Idempotent creation replays can return the cached original response (for example the original unpaid PI), while the subsequent authoritative provider state is succeeded. Resource identity equality is the idempotency assertion; no claim is made that cached responses represent current payment state. The expiry checks used Stripe's explicit expire endpoint; they did not wait for natural session-clock expiry or alter app reservation timestamps. A cancelled-browser-return flow is not equivalent to these provider-only session checks.

The first main run retained 14 checkpoints: 11 pass and three nonpasses. One nonpass was a local harness schema assumption: a successful Refund response omits livemode. The refund had already been created under verified isolated mode. The corrected runner permits only documented refund/transfer_reversal/account response objects without that field after proven account/anchor preflight, and always rejects livemode true when present. Same-key refund-only recovery passed, retained exactly one refund, and supersedes that harness nonpass. Its two pass records repeat the mode anchor and add the refund result: deduplicated total 12, not 13. Main/recovery runner exit 0 indicates completed attempts, not blanket scenario PASS; individual records and capability gates determine classification.

The main final error serialization did not retain a complete mutation ledger; do not infer provider mutation counts from an absent array. Each POST's required preflight is enforced by the reviewed code. Final capability reads corroborate the two unresolved provider boundaries: `/v1/accounts` and `/v1/disputes` both returned invalid_request_error with controlled classifications `restricted_claimable_scope=true`, `requires_claim=true`. Raw error messages were not published. No Connect transfer/reversal, dispute evidence submission/closure, or bank payout occurred in this fresh run.

## Inherited normal app provider evidence

These earlier runs used SecondPart's configured Sandbox and the normal application workflow. They are retained evidence, not fresh October 8 executions or readbacks. Today's anonymous Sandbox key restriction does not invalidate their genuine Connect transfer and reversal PASS results.

The September 21 checkout record, completed by the September 30 return/refund follow-up in `2026-09-21-sandbox-checkout.md`, documents:

- Order `2766715b-3d07-4f66-be8e-75ae1650875f`, item `c031a1d4-2896-4bfd-b3b8-f8a6c758fb38`, PaymentIntent `pi_3UI6AA2RWsyIBCbK1r44MsX4`, charge `ch_3UI6AA2RWsyIBCbK1E9rygyY`; normal Checkout payment, fulfilment, receipt and explicit acceptance completed. The hosted completed-order verifier recorded 13 PASS, zero pending and zero fail.
- Actual GBP 5.00 seller transfer `tr_3UI6AA2RWsyIBCbK1uG7sJSn`, livemode false, was released after explicit buyer acceptance. The September 30 normal return flow then produced successful GBP 5.00 refund `re_3UI6AA2RWsyIBCbK1nXHrAZn` and exactly one full reversal `trr_1ULNGG2RWsyIBCbKQsCWrkFI`.
- Final documented order/item state was refunded and payout reversed; listing remained sold with stock zero under the reinspection policy. No dispute lifecycle, bank payout or fresh October adverse-flow PASS is inferred from this run.

The separate September 15 `2026-09-15-provider-refund-reversal-e2e.md` documents a GBP 89.00 full application refund/reversal: order `6b816b03-9d35-4a15-a4f9-cad7357644f3`, item `ca8e4d20-3761-4bb4-b5e6-3207ee2a2728`, transfer `tr_3UFtH42RWsyIBCbK1TuMU5Y0`, reversal `trr_1UFvjo2RWsyIBCbKFIWfKYEg`, and refund `re_3UFtH42RWsyIBCbK1tEHtQBa`. Retrying the resolved refund returned already_refunded while provider refund and reversal counts remained exactly one. None of these existing objects was mutated for the current isolated run.
## All 15 requested scenarios

| Requested scenario | Fresh automated evidence | Remaining actual integration boundary |
| --- | --- | --- |
| Declined payment | Actual isolated PI issuer decline; actual-handler/static inventory-safety checks | Decline inside a linked app Checkout Session |
| Retry after decline | Actual same PI remains retryable after two declines | Same open Checkout Session retains its app reservation |
| Successful retry | Actual same PI succeeds once for GBP 5 | Paid webhook persists linked app order/stock once |
| Cancelled checkout | Actual unpaid Session expires and expiry replay is stable; local web/mobile cancellation behavior | Normal browser cancel + linked app stock restoration |
| Expired checkout | Actual Stripe explicit expiry; local actual SQL cancellation guards | Linked provider webhook/reconciliation and natural clock expiry |
| Duplicate checkout request | Actual same-key Session creation returns same ID; local attachment/reservation guards | Full authenticated app request duplicates |
| Duplicate click / idempotency | Actual PI/Session creation and expiry key replays; local provider retry guards | Browser double-click against a committed linked order |
| Webhook replay | Reduced-schema actual SQL event deduplication, local handler/error checks | Genuine delivery/replay into a fully isolated linked app; no shared resend attempted |
| Out-of-order webhook | Actual SQL paid-versus-expiry, preattachment paid, create-before-paid and close-before-create tests | Controlled provider delivery order into isolated linked app |
| Final-stock concurrency | Existing isolated PG17 two-connection CI harness; local reservation/payment SQL contracts | No fresh shared-host/provider final-unit race was run; root owns exact CI result |
| Reservation expiry | 18 static provider-authority invariants and actual SQL expiry/idempotency tests | Actual linked app reservation expiry with provider authority |
| Refund idempotency | Actual standalone refund count 1 after exact-key replay; actual core refund behavior with mocked provider | Fresh full normal app return/refund workflow; historical proof remains separate |
| Transfer reversal | Adapter/core recovery/SQL tests; historical genuine provider proof | Fresh isolated Connect capability requires a claimed eligible Sandbox |
| Dispute lifecycle where supported | Actual test source payment succeeded; actual SQL ordering/terminal/recovery tests | Dispute API read/update scope blocked on claimable key; no lifecycle PASS |
| Payout rollback / reconciliation | Actual worker tests cover lost transfer response, case guard, receipt window and repeated release; SQL reversal claim tests | Fresh isolated Connect money movement and durable app correlations, without global workers |

No new shared listing, order, seller payment account, case, Auth/Storage deletion, SQL DDL or cleanup was introduced to close these gaps. Provider tests retained their isolated test objects; there is no hosted fixture cleanup requirement. Genuine provider-to-app integration needs an isolated application/database boundary; rollback-only hosted SQL cannot preserve state for an external asynchronous payment/webhook flow.

## Webhook P2 repair and verification

Root approved a bounded error-isolation fix after local reproduction showed unsupported/missing-order events returning 200 with zero commerce RPC/provider calls but one global push scheduling call. Root cause was unconditional `schedulePushDispatch(50)` in the actual webhook handler. The helper can claim unrelated push outbox rows and send FCM when configured.

`src/app/api/stripe/webhook/route.ts` now schedules only after a handled commerce outcome: paid confirmation, authoritative cancellation true, reconciliation state paid/expired, non-null opened dispute case, or successful dispute close. Missing/unhandled events, refused stale cancellations, nonmutating reconciliation states and errors schedule nothing. Normal payment state authority remains unchanged. No actual signed webhook was delivered to shared Preview to test this fix.

TDD evidence: initial actual-handler suite 12 pass / 8 fail before the guard; added nonmutating reconciliation regressions failed 5 cases before refinement; final handler suite **26/26 PASS**. `scripts/test-qa-isolated-stripe-sandbox.mjs` covers wrong account, live access, absent test key, incomplete/active webhook inventory, foreign/unmarked references, raw card data, GBP amount bound, credential/body diagnostic secrecy, actual single-quoted CLI TOML, and object-specific mode schemas: **37/37 PASS**. The diagnostic secrecy regression reproduced two failures before boolean-only generic assertions replaced raw-value assertion payloads.

Existing 15-file Stripe local behavioral/reduced-SQL set passed 173/173. A final 17-file run before the last seven runner schema tests passed **229/229**, exit 0; the final focused runner/handler run then passed **63/63**, exit 0. These sets overlap and must not be added together. Root separately reran the final source integration suite and CI; its canonical report owns the nonoverlapping totals and final build evidence. Focused ESLint and git diff --check passed. Static validators passed commerce E2E harness 40 checks, checkout expiry 18 checks, payout recovery 17 checks: **75 static checks**, distinct from provider tests.

These local files execute actual compiled application logic with mocked provider/DB dependencies, or real SQL in a reduced PGlite schema. They do not become provider E2E merely because their names contain Stripe. True PG17 last-stock and dispute-reversal concurrency are CI jobs against ephemeral local databases, not shared hosted mutations. Their precise run/job result is owned by root.

## Retained sanitized evidence

Private task directory: `C:\Users\joann\AppData\Local\Temp\secondpart-isolated-stripe-293c926c-1446-4e4a-a489-352d49fecb5d`. Only sanitized files may be forwarded as evidence; the profile and raw logs are excluded.

- `sanitized-results.json` SHA256 `76AEA73A385A8800347850C8458945CD610EE5BCC6540048FC374D09FE9B4058`.
- `sanitized-refund-recovery.json` SHA256 `729F8CCC23E1556C170C5E326D5C8B8F656DC829AFF6400850A23332ABEC7BCF`.
- `sanitized-capabilities.json` SHA256 `29D7B0397F6446ADF164205E19C50A7CA188CAB7E7D28AC446DA97CF620F4291`.
- Final 229-test local TAP: `secondpart-stripe-final-local-bd9846ab-d8a4-4561-b795-92a26906cee9.tap` in TEMP.

## Smallest remaining prerequisite

No owner interaction was needed for the fresh direct-API decline/retry, idempotency, expiry or refund proof. The anonymous credential cannot exercise Connect/dispute APIs. Continuing those provider scenarios requires claiming a disposable eligible Sandbox and a tightly scoped test-only credential for the needed Connect/dispute operations. Root can automate the fixture/provider work after that credential exists; no Live key or existing customer/seller target is needed. Claiming requires real account ownership and is not bypassed by creating or copying another key.

Full marketplace adverse-flow signoff separately requires a permitted isolated app/database with normal QA buyer/seller/readiness fixtures and webhook delivery. If Stripe's hosted Checkout security prevents safe automated browser payment interaction, the compact owner gate is one Sandbox Checkout decline followed by a successful retry; [Stripe distinguishes frontend interaction restrictions from safe server-side API tests](https://docs.stripe.com/automated-testing). The present direct API proof does not assert that this browser interaction already passed. These are explicit prerequisites, not reproduced P0/P1 defects or a request to reopen rejected shared-host concurrency fixtures.

Repository copies of sanitized provider evidence: [main checkpoints](2026-10-08-isolated-stripe-results.json), [same-key refund recovery](2026-10-08-isolated-stripe-refund-recovery.json), and [capability classifications](2026-10-08-isolated-stripe-capabilities.json). Original file hashes above remain reproducible; no profile or raw logs were copied.
