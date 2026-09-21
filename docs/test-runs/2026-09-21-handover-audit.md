# SecondPart continuation audit — 21 September 2026

## Source and workspace reconciliation

The handover is contextual history, not authority to overwrite implemented behaviour or waive release gates. Compared it with current code, canonical readiness documents and connected Supabase migration history.

- Original checkout: `C:/Users/joann/SecondPart-Codex`, `rebuild-nextjs`, HEAD `66b94bf6d1c9b160dacf9e312925a9c1cd2d3c6c`, with pre-existing uncommitted refund/dispute/lookup changes.
- Fresh GitHub branch read and fetch: `origin/rebuild-nextjs` is `1a2f447ea49d6e94db097e0f12d9ce2f1848c0ae`, **356 commits ahead**. The original checkout must not be pushed as if current or reset over its uncommitted work.
- Current implementation worktree: `C:/Users/joann/.codex/worktrees/secondpart-handover-audit/SecondPart-Codex`, based on that exact remote SHA. It is detached and no push/deployment is implied.
- Current canonical release register: `docs/superpowers/plans/2026-09-16-rc-hardening-status.md`, updated through 18 September. The latest previously verified application SHA is `333a9a1da111f5de528dc4df02e070217affd3a3`; 616-test CI and provider/device evidence there are historical scoped evidence, not tests rerun today.
- Fresh GitHub combined status confirms Vercel success for that application SHA. Fresh GitHub job/step readback of run `35360904820` confirms SUCCESS for `validate`, `last-stock-concurrency` and `marketplace-scale-postgres`. These remain historical executions, not new tests of this local patch. No physical-device execution was claimed.
- Connected `secondpart` project read-only inventory: healthy PostgreSQL 17; 203 migrations, latest `20260918122032 / restrict_seller_checkout_ready_anon`. The later migration history matches the newer source, not the old checkout.
- Read-only schema checks confirm `private.case_evidence_cleanup` (catalog search across schemas), `transaction_refund_attempts` and `transaction_dispute_reversal_attempts` are absent. The latter two belong to the old uncommitted candidate, not the current canonical refund design. Do not deploy those old files indiscriminately.

Early investigation in the old checkout reproduced two candidate SQL defects and temporarily tested a local repair (18 SQL tests and 508 aggregate tests passed). Once remote drift was discovered, only this turn's exploratory edits were undone; pre-existing work remains. Those results are **not** the current release baseline or a deliverable.

## Function → evidence → remaining gap

| Area | Confirmed boundary | Remaining gap / priority |
| --- | --- | --- |
| Web architecture | `package.json`, current Next.js/React/TypeScript app; hosted frontend in Android wrapper | Full release sign-off remains separate |
| Home / Garage / compatibility | `src/app/garage/page.tsx`, `src/components/garage-vehicle-use-control.tsx`, marketplace filters; new-vehicle route and explicit fit filter exist | Physical navigation/Back/zoom validation, P0 device gate |
| Catalogue / fitment / inventory | Current search SQL, compatibility guards, CSV importer, existing 100k PG and last-stock CI proofs documented | Hosted provider/UI stock race and real inventory evidence; no fabricated fitment |
| Accounts / Buyer and Seller | Auth and separate account/dashboard paths exist; seller retains buyer access | TokenHash project email templates + normal confirmed-account lifecycle, P0 |
| Checkout / fulfilment / transfer | Historical real sandbox purchase and transfer evidence in commerce reports | Decline/abandon/retry/expiry UI/provider proof needs truthful checkout-ready listing, P0 |
| Refund / reversal | Current `commerce-refunds.ts`; real sandbox full refund after payout + reversal and retry documented in `2026-09-15-provider-refund-reversal-e2e.md` | Other variants and financial failure boundaries remain distinct; do not call generic refund missing |
| Provider disputes | Deployed ordering SQL and regression suite exist | This audit reproduced a pre-reversal terminal-outcome guard defect; fixed locally below. Concurrent/uncertain reversal recovery remains separate |
| Find My Part | `/requests` and bounded public response loader show linked active seller offers with delivered-total comparison | Broader real seller response network; no need to rebuild response UI |
| Support / moderation / notifications | Support conversation routes, moderation and historical real Preview alert receipt exist | Monitored public mailbox, Production alert configuration, physical FCM |
| Account deletion | Deployed minimization and application processor; source/hosted preflight recorded | Destructive E2E on a fresh legitimately confirmed disposable account; legal retention sign-off |
| Evidence cleanup | `src/lib/case-evidence-cleanup.ts` and `20260918154500_case_evidence_cleanup_outbox.sql` implement staged rollout | Hosted outbox absent on fresh readback; controlled migration review/deployment and privilege readback required |
| Android / Play | Production workflow enforces package `com.secondpart.marketplace`, API 36 and disabled WebView debugging; signed Preview artifact recorded | Physical signed-device matrix, production signing/domain/Firebase/Play account and actual release AAB |
| PayPal | No PayPal integration references found in current `src` or canonical payment decisions | Unimplemented in inspected source; explicit scope decision remains open, not silently removed |
| Business / liquidity | No engineering test can prove operational readiness | LTD/identity, legal terms, support ownership, real sellers/inventory remain external |

Current Google policies, D-U-N-S timing and legal requirements were not re-audited in this code-focused batch. Handover statements are not a new regulatory sign-off.

## First current-code repair: provider dispute terminal guard

Problem: `closeProviderPaymentDispute` read only `order_item_id` and only for a `lost` event. A contradictory `lost` event for an already `resolved/won` case could call `reverseSellerTransfer` before any outcome consistency check. Unsupported terminal status and unavailable case evidence on the won branch could also reach SQL finalization.

Change: validate terminal status, read persisted case status/outcome for all close events, and reject conflicting known terminal outcomes before either provider mutation or SQL close. Missing/unavailable case evidence throws so the existing webhook error path can retry. Matching replay and normal lost-event handling retain the existing path.

Files:
- `src/lib/commerce-provider-disputes.ts`
- `scripts/test-provider-dispute-terminal-guard.mjs`

TDD: 9 expected failures / 2 passes before implementation; 11/11 pass afterward. Independent reviewer reran all 11 and found no important issues.

Limit: this is a server-side snapshot guard, not an atomic concurrent-event protocol or proof of provider recovery. No SQL migration, payment, refund, transfer, account deletion, Production promotion or Play submission was executed. Durable reversal claims/unknown-outcome recovery and stronger SQL terminal immutability must be evaluated against the current design as a separate next task; do not port the stale migration wholesale.

## Verification

- Current full suite: **627/627 PASS**, zero skipped/failed.
- All 14 repository static validators: PASS. These are invariant checks, not provider/device E2E executions.
- `git diff --check`: PASS.
- Lint: PASS, with four pre-existing unused-variable warnings in three legacy mobile-shell files and `scripts/test-mobile-buyer-orders.mjs`.
- Typecheck: PASS.
- Production build: PASS (exit 0), with CI-style placeholder Supabase/site configuration, no `.env.local` copied. Initial lint/typecheck/build invocation overlapped npm installation and failed because executable shims were not yet available; completed-installation reruns all pass and supersede that setup failure.
- No new CI, deployment or hosted migration is claimed for the local patch.

## Next sequence and owners

1. Codex: local validation and independent review are complete. Retain this audit and reviewed patch; integrate against current `rebuild-nextjs`, preserving old uncommitted work. No commit or push was made in this batch.
2. Codex: local dispute reversal recovery/SQL consistency implementation and review completed in the [follow-up report](2026-09-21-dispute-reversal-recovery.md). Hosted rollout and sandbox provider proof remain separate gates.
3. Codex + owner of hosted configuration: controlled Auth template configuration and cleanup-outbox rollout; then normal confirmation and disposable deletion E2E. Inspect current project impacts before mutation.
4. Joanna + QA: truthful listing evidence for adverse checkout/provider race, signed Android device matrix. LTD does not block these technical preparations.
5. Joanna: company identity, monitored support mailbox, production accounts/domain, legal review and real seller supply. PayPal launch scope needs an explicit product decision.

SecondPart is not globally launch-ready. Existing sandbox success, source completion, hosted deployment, physical-device acceptance and Play approval remain distinct gates.
