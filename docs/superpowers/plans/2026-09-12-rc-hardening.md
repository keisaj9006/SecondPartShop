# SecondPart Release Candidate Hardening

Canonical RC gap register and execution plan. Started 2026-09-12 from clean `1316a2725e832849e8561f075411dc96e7223088`, `origin/rebuild-nextjs`. Product Excellence is complete; its evidence is inherited, not repeated. This document tracks remaining work; linked runbooks define the existing procedures and accepted policies.

## Scope and release rule

Only `rebuild-nextjs`, Preview and synthetic Stripe test-mode scenarios are authorized. Never modify main, Production, real financial data or accepted Buyer Protection policy. Confirm provider test context before financial operations. Preserve existing QA fixtures. No real email or alert delivery without an appropriate configured test destination. New financial scenarios require UI, provider and database evidence, not only static validators.

P0 blocks closed beta; P1 is required before public launch; P2 is later advantage. EXTERNAL identifies a prerequisite, not a pass or waiver. VERIFIED applies only to the precise observed boundary. An external P0 still blocks the affected release scope. Web-only versus Android closed beta and commerce versus browse-only scope require an explicit business ruling if gates remain unmet.

## Starting environment evidence

- Remote branch SHA matches local HEAD; GitHub run `34719583061` is successful for that SHA.
- Preview `dpl_CXwjxHJMnr5Mdnf9L3xqUErwg8NB` is READY for that SHA; alias alignment is checked separately during execution.
- Supabase `etkupijfdznljimrfyct` is ACTIVE_HEALTHY, PostgreSQL 17.6.1.166; 188 recorded migrations, latest `20260912113148 / complete_marketplace_search_page`.
- Safe aggregate snapshot: 8 parts, 5 sellers, 2 orders. Older liquidity snapshots are historical, not current readiness evidence.
- Security advisor: 9 INFO no-policy tables; 17 anon and 63 authenticated SECURITY DEFINER exposure warnings require policy/function-specific interpretation, not blanket privilege revocation. Leaked-password protection is disabled (EXTERNAL configuration).
- Existing Product Excellence evidence: `docs/test-runs/2026-09-12-product-excellence.md`. Existing commerce happy-path and duplicate transfer evidence: `docs/test-runs/2026-09-11-commerce-preview-preflight.md`.

## Gap register

| Area | Classification / current evidence | Smallest next action and completion evidence |
| --- | --- | --- |
| 1 Returns, cancellations, disputes, refunds, reversals | P0: implemented lifecycle, real adverse provider scenarios unsigned | Audit exact current state guards; regress confirmed defects; execute isolated synthetic scenarios with matching UI/Stripe/Supabase outcomes and no duplicate money movement. |
| 2 Decline, abandon, retry, expiry | P0: reservation and paid-confirmation guards already implemented; scenario H unsigned | Prove decline then authorized retry and expiry ordering using existing harnesses plus test provider where sessions permit. |
| 3 Last-stock concurrency | P0: row-lock protections exist; true two-connection race unsigned | Add or execute actual overlapping transaction proof in isolated PostgreSQL; single-session tests cannot establish concurrency. External environment/session prerequisite remains explicit. |
| 4 Idempotency | VERIFIED: completed transfer replay/refresh/endpoint repetition only; P0: refund/reversal/retry coverage incomplete | Exercise each provider operation's stable key and database state transitions; record object counts before/after. |
| 5 Delayed/out-of-order webhooks | P0: provider-authoritative guards exist, adverse order evidence incomplete | Inspect event handling, add exact synthetic out-of-order regressions, then corroborate provider replay where safe. |
| 6 Received / Accept / 48 hours | VERIFIED: explicit acceptance happy path; P0: timed/blocked release branches | Preserve Received-started 48h window and case blockers; silence alone must not release. Test state/time branches without changing live timestamps or business policy. |
| 7 Roles and authorization | P0 evidence gap across buyer/seller/admin/moderation boundaries | Review actual server/RPC ownership checks; prove negative paths synthetically and with safe read-only Preview requests. Do not modify Moira. |
| 8 RLS, Storage, upload, private data | VERIFIED scoped image integrity/RLS regressions; P0 unproven provider failure/concurrency boundaries | Inspect grants/policies against each exposed function; no blanket advisor-driven revocation. Use isolated failure tests; no shared-provider outage. |
| 9 Messaging/notifications/email/FCM | P0 critical order communication evidence; EXTERNAL real mailbox/device delivery | Verify queued/visible states and authorization without sending real email; actual email/FCM receipt remains manual/configuration gate. |
| 10 At least 25,000 listings | P1 public-scale evidence missing: current database has only 8 parts; existing benchmark uses a surrogate table | Run exact current search SQL in isolated synthetic 25k fixture, measure bounded pages/global ordering and record runtime limitations. This does not prove hosted latency, image delivery or concurrent load. |
| 11 SEO / origins / sitemap | VERIFIED Preview noindex, safe metadata, no invented canonical; P1 EXTERNAL production origin | Preserve Product Excellence checks. Canonical/sitemap deployment needs approved domain; no empty SEO landing page generation. |
| 12 Monitoring and diagnosis | P0 EXTERNAL alert destination verification; P1 concrete CSV lookup diagnostic gap | Preserve sanitized structured errors. CSV preflight currently returns bounded error without diagnostic cause; add synthetic-safe operation/error-code evidence if confirmed. Never claim transient provider cause fixed without evidence. |
| 13 Privacy / deletion / retention / legal / support | P0 EXTERNAL legal identity/wording/support sign-off; disposable deletion E2E unsigned | Review implemented blockers and retention code; synthetic regressions first. No deletion of existing QA accounts. Legal period changes require decision. |
| 14 Web / Android | VERIFIED mobile navigation/Back and responsive web; EXTERNAL physical signed build, links, FCM, upload, external return | Preserve `docs/android-rc-test-matrix.md` gates. Browser emulation is not physical-device evidence. |
| 15 Accessibility | VERIFIED combobox/keyboard/reduced motion/responsive checks; EXTERNAL native zoom and screen readers | Keep manual gate for supported native zoom/SR on critical journeys; do not relabel axe results as SR pass. |
| 16 Bulk seller operations | VERIFIED CSV preview retention and synthetic partial-save/retry tests; P0 actual partial import evidence incomplete | Use project-supported synthetic fixture import only after scoping cleanup/retry safety. Preserve unique seller references and fail-closed checks. |
| 17 Find My Part / quotes / fitment | VERIFIED context preservation/fitment evidence guards; EXTERNAL DVSA approval; P2 broader catalogue/network | Check core request/quote completion and ownership paths. Manual vehicle fallback remains valid; never fabricate compatibility. |
| 18 Unassisted basic tasks / liquidity | P0 any confirmed blocker to ordinary buyer/seller completion; EXTERNAL real seller supply and operational ownership | Prioritize concrete failures from scoped reviews. Do not equate test inventory or code completion with a functioning market. |

## Execution order and verification

1. Finish bounded financial and data/journey reviews; append confirmed defects and exact prerequisites here. Reuse completed proof; no broad repeated audit.
2. Immediately reproduce and repair unblocked P0 defects with regression tests. Review independently before commit. External provider/session gates do not stop unrelated work.
3. Execute unblocked P1 diagnostic and isolated scale work. Use the real search migration and existing reduced-schema harness, never seed shared Supabase with 25k rows.
4. For each changed subsystem run focused tests plus relevant validators, lint, typecheck and production build. Run full tests for integrated changes; record static versus provider evidence separately.
5. Push verified logical commits only to `origin/rebuild-nextjs`; verify CI, exact Preview SHA and aliases, then observe relevant Preview behavior.
6. Record remaining external/manual gates with precise prerequisites. Closed beta remains NOT READY until its P0 evidence is complete; do not infer readiness from green CI.

## Execution evidence

In progress. No new RC scenario is marked PASS at plan creation. Product Excellence and the completed Stripe happy path retain their original scoped PASS evidence.

### Confirmed defects, first implementation batch

- **RC-P0-01 provider cancellation authority:** web `/checkout/cancel` and mobile checkout cancellation release local stock without first closing the attached Stripe session. A still-payable session can then produce paid-provider/cancelled-database divergence. Session attachment also checks error alone, not affected row count, allowing an unattached session URL to escape after a race. Repair shared cancellation/attachment handling, preserve paid confirmation authority and fail closed on ambiguous provider state. Regression must cover open/expired/paid/complete sessions, provider error, ownership, zero-row attachment and retries. Provider E2E stays unsigned until observed.
- **RC-P0-02 deletion minimization:** current `prepare_claimed_account_deletion` clears seller geo/description but retains identifying name/location/slug; donor registrations/notes and import filenames also survive owner detachment. This contradicts `docs/account-data-retention.md`. Extend only the guarded finalizer with deterministic tombstones and scoped field scrubbing; preserve accounting IDs, blocker checks, request binding, grants and unrelated sellers. Prove in isolated SQL that blocked/mismatched requests do not scrub data and successful/repeated finalization does. Deploy function definitions only after review; do not run deletion against existing QA accounts.
- **RC-P1-01 lookup limiter:** `consumeVehicleLookupRateLimit` currently grants access on database error/missing row/exception. Fail closed with honest temporary-unavailable guidance and safe diagnostic codes; keep normal quota exhaustion distinct and manual vehicle selection available. Synthetic route tests must prove zero provider calls during limiter failure.
- **RC-P1-02 request response delivery:** linked listing publication marks seller match responded but the buyer request view does not expose the response and no buyer notification is emitted. Confirm visibility/ownership and add only the existing expected response delivery, idempotently; do not invent quotes or compatibility.
- **RC-P1-03 CSV diagnosis:** retain the known fail-closed behavior and add safe operation/code correlation for lookup failures without CSV contents, registrations or filenames. This improves diagnosis; it does not establish the earlier intermittent failure's underlying provider cause.
- **RC-P0-03 refund authority:** `commerce-refunds.ts` finalizes any non-throwing refund response, including pending/failed. Finalize only verified success; retain durable pending correlation/reconciliation and stable idempotency for retries. Test pending, failed, success, repeat, reversal and database-finalization failure before provider QA.
- **RC-P0-04 dispute event ordering:** dispute open/close RPCs consume event IDs before order/case linkage exists; replay can permanently skip the outcome. Late return states also conflict with the single-active-case constraint. Make event consumption contingent on durable handling (or retry), preserve provider outcome authority, and test create-before-paid / close-before-create / duplicate / late-return sequences with actual isolated SQL.
- **RC-P0-05 receipt idempotency:** repeated Received recomputes `release_eligible_at` from now despite keeping the original receipt timestamp. Preserve the first receipt deadline and avoid duplicate semantic events; later explicit Accept still follows existing eligibility and active-case guards. Test synthetic time shifts, ownership, paid-state and case boundaries; no live timestamp edits.

Additional P1/public questions from the data review: public full seller postcode exposure requires a deliberate public data contract (UI hiding alone is insufficient); in-app support intake has no user-visible reply/status journey and depends on the real monitored support mailbox. Do not broaden these into unapproved account or support product redesigns. Matched-seller visibility of Find My Part free text should be explained without exposing registration/identity.

Fresh alias checks confirm both stable and branch Preview aliases point to `dpl_CXwjxHJMnr5Mdnf9L3xqUErwg8NB`. QA Seller's existing fixture edit session is available; the Stripe tab is labelled sandbox/test. Provider operation authorization still requires fresh test-mode confirmation.

Read-only deployed privilege check: cancel/confirm-paid/dispute-open/dispute-close/deletion-finalizer RPCs deny anon/authenticated and allow service_role. The deployed deletion finalizer also lacks seller-name/donor scrubbing, corroborating RC-P0-02. Browser QA Seller `/admin/system` redirects to `/account?error=admin-required` and shows the access-denied message. This proves that route boundary only, not the full role matrix.

### Observed RC negative paths at baseline HEAD

- Anonymous HTTP `GET /api/mobile/v1/seller/listings`, `DELETE /api/mobile/v1/orders/00000000-0000-4000-8000-000000000099/checkout`, and `POST /api/mobile/v1/seller/listings/00000000-0000-4000-8000-000000000099/photos`: all returned **401**, `{ok:false,error:unauthorized}`, `Cache-Control: no-store`. No auth header, body, real object ID or provider operation was used. These are actual HTTP negatives, not mocked route tests.
- QA Seller attempting to open another seller's existing active fixture `40000000-0000-0000-0000-000000000001` in the edit route received **Page not found**, with no editable listing data. No save/upload was attempted.
- Preview metadata shows Stripe key/webhook, Supabase service role/URL variables present; `CRON_SECRET` is scoped to `rebuild-nextjs`. Values were neither displayed nor changed. Presence does not prove valid credentials or scheduled execution.
- `OPS_ALERT_WEBHOOK_URL` is absent for Preview. Real alert delivery is **EXTERNAL / not tested**, not PASS. Do not send a real alert to an improvised destination.
