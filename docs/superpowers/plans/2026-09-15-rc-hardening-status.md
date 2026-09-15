# SecondPart RC hardening — current status 2026-09-15

This file is the current execution-status companion to `2026-09-12-rc-hardening.md`. Where an older gap classification conflicts with evidence recorded below, this newer status is authoritative for the observed boundary. The original plan remains the historical execution plan and defect register.

## Clean application boundary

Latest fully verified clean application code boundary used for the hosted evidence in this status:

- SHA `03b62cfb0747cda006d6c0158097b80fcf2f459a`
- GitHub Actions `34998569234`: full PASS
- Vercel Preview `dpl_AZjvFjkjmTYdgTjs1TGNfYrozjzp`: READY on exact SHA
- temporary QA actor/bootstrap routes removed; `/qa/actor-switch` and `/api/qa/actor-switch` return 404

Later commits in this status file set are documentation-only `[skip ci]` unless explicitly stated otherwise.

## Current gap register

| Area | Current classification | Evidence / remaining exact boundary |
| --- | --- | --- |
| Returns / refunds / reversals | **VERIFIED for real refund+released-payout reversal E2E** | Genuine Preview UI → Stripe sandbox → Supabase flow at £89. One seller transfer, one reversal, one buyer refund. Provider retry reused same IDs and object counts remained 1+1. `docs/test-runs/2026-09-15-provider-refund-reversal-e2e.md`. Other cancellation/dispute provider scenarios remain separate boundaries. |
| Decline / abandon / retry / expiry | **P0 UNSIGNED provider/UI** | Code/SQL authority and ordering regressions are strong, but a fresh Stripe Checkout decline→retry and provider-confirmed abandon/expiry flow still needs an authenticated disposable checkout-ready fixture/session. Do not fabricate fitment to manufacture it. |
| Last-stock concurrency | **VERIFIED database concurrency; P0 provider/UI unsigned** | True two-connection PostgreSQL race: one winner, one loser, stock/order invariants exact. Full Stripe/UI Scenario G remains separate. |
| Refund/reversal idempotency | **VERIFIED provider-level** | Stable keys plus genuine provider retry: refund count 1, reversal count 1, IDs unchanged. |
| Delayed/out-of-order events | **VERIFIED code + deployed SQL + hosted PostgreSQL 17** | Pre-attach paid retry, duplicate delivery, paid-vs-expiry, expiry-first-vs-late-paid, dispute close-before-open, duplicate open/close and late-return reuse all passed rollback-only hosted probes. Deliberate Stripe-side replay of every adverse event ordering remains separate. |
| Received / Accept / 48h | **VERIFIED state semantics + explicit-Accept provider path** | Deployed `auto_release_hours=48`; hosted rollback proves first Received exact 48h, retry preserves deadline, explicit Accept immediate, active case blocks. Real prior Accept produced Stripe seller transfer. Natural elapsed 48h auto-release has not been artificially time-shifted. |
| Roles / authorization | **VERIFIED current application + hosted DB boundary** | Every current admin page/action guarded; permanent recursive regression added; real buyer/seller denied on admin RPCs; buyer cannot self-promote admin; anonymous Preview admin routes sign-in gated. `scripts/test-admin-authorization-boundary.mjs`, CI `34997934650`, evidence in `2026-09-15-p0-authorization-ordering-buyer-protection.md`. |
| RLS / Storage / private data | **VERIFIED scoped hosted boundary** | Outsider cannot read seller draft/image/object; owner reads own; client object update/delete denied; owner upload predicate + reserved blocker; case-evidence participant/outsider/finality all passed rollback probes. No deliberate shared Storage provider outage. |
| Messaging / notifications | **VERIFIED in-app + authorization; EXTERNAL FCM/email receipt** | Genuine £89 flow created paid/ready/accepted/completed/case/refund notifications with dedupe keys. Notification RLS owner-isolated. Buyer↔seller transaction-message rollback proof produced counterpart notifications; outsider denied. QA profiles have no registered FCM devices. Physical FCM/email remains manual/external. |
| Scale | **VERIFIED isolated PostgreSQL engineering scale well beyond 25k** | CI continuously runs exact migration against isolated 100,000-listing PostgreSQL fixture plus single-scan checks. This is not hosted concurrent latency/image CDN proof. |
| SEO / production origin | **Preview VERIFIED; production domain EXTERNAL** | Preview remains noindex. Canonical/sitemap production behavior stays gated on approved real Production origin/domain. |
| Monitoring / diagnosis | **VERIFIED engineering; EXTERNAL real alert receipt** | Redaction/sanitization, structured diagnostics and privacy-safe CSV operation/code evidence pass. Preview 24h runtime query had no error/SECOND_PART_OPS logs. No approved alert test destination configured; do not claim receipt. `2026-09-15-p0-monitoring-diagnosis.md`. |
| Privacy / deletion / retention | **VERIFIED deployed preflight; destructive E2E + legal EXTERNAL** | Hosted finalizer now includes donor/import/seller minimization and service-role-only guard. Zero current deletion requests. Full Auth+DB+Storage destructive run requires disposable account. UK legal periods/business-name treatment/privacy wording require sign-off. `2026-09-15-p0-privacy-deletion-preflight.md`. |
| Web / Android | **Web scoped VERIFIED; physical Android EXTERNAL** | Mobile/web navigation/responsive code and validators pass. Signed physical-device app links, FCM, uploads and external-return checks remain manual/device gates. |
| Accessibility | **Engineering VERIFIED; native SR/zoom EXTERNAL** | Existing keyboard/combobox/reduced-motion/responsive regressions pass. Do not relabel automated/browser checks as TalkBack/screen-reader/native zoom PASS. |
| Bulk seller CSV | **VERIFIED hosted partial import + retry/uniqueness contract** | Real hosted partial batch `60ce6125-27a0-44da-bde6-335284708bb5`: 2 received, 1 draft created, 1 rejected. Draft batch-linked. Seller reference lookup owner-scoped/case-insensitive; deployed unique index prevents duplicates; importer regressions prove safe partial retry/recovery. `2026-09-15-p0-bulk-seller-csv.md`. |
| Find My Part / responses | **Engineering ownership/response projection VERIFIED; real request/quote fixture absent** | Buyer request RLS owner-only; seller leads require active seller match; buyer response projection only active linked listings and excludes registration/private seller fields. Hosted QA currently has zero request rows, so no false real request E2E claim. DVSA remains external; manual vehicle fallback remains valid. |
| Unassisted tasks / liquidity | **EXTERNAL operational gate** | Test inventory and green code do not create marketplace liquidity. Real seller supply, operational ownership and launch liquidity targets remain business execution gates. |

## Evidence added 2026-09-15

- `docs/test-runs/2026-09-15-provider-refund-reversal-e2e.md`
- `docs/test-runs/2026-09-15-p0-authorization-ordering-buyer-protection.md`
- `docs/test-runs/2026-09-15-p0-rls-storage-notifications.md`
- `docs/test-runs/2026-09-15-p0-privacy-deletion-preflight.md`
- `docs/test-runs/2026-09-15-p0-monitoring-diagnosis.md`
- `docs/test-runs/2026-09-15-p0-bulk-seller-csv.md`

## Remaining P0 / external checklist before declaring closed beta ready

1. **Stripe adverse checkout provider/UI:** fresh decline → authorized retry and provider-confirmed abandon/expiry on a deliberately disposable truthful listing. The current dedicated checkout draft lacks truthful compatibility evidence; do not invent it.
2. **Full provider/UI last-stock race:** database race is proven, but simultaneous real Preview/Stripe checkout scenario remains unsigned.
3. **Natural 48h auto-release observation:** state/time rules are proven; actual elapsed timer → provider payout still needs observation if required for beta sign-off.
4. **Physical Android:** signed build/device app links, FCM receipt, upload and external-return matrix.
5. **Approved alert destination receipt:** configure a real test destination and observe a smoke alert; current absence is not PASS.
6. **Destructive deletion E2E:** disposable authenticated account only; never delete an existing QA account for evidence.
7. **Auth leaked-password protection:** Supabase Auth project setting remains an external configuration gate unless changed in the dashboard/API with proper Auth configuration authority.
8. **Legal/support:** contracting identity, retention periods/privacy wording and real monitored support mailbox/operational ownership sign-off.
9. **Marketplace liquidity / seller supply:** operational rather than engineering completion.

Closed beta is therefore **not globally READY yet**, but the remaining gap set is now substantially narrower and explicitly separated into provider-session, device/configuration, legal and operational gates. Green CI alone must not be used to waive them.
