# Release audit — 11 September 2026

Historical initial audit only. The later commerce run in `2026-09-11-commerce-preview-preflight.md` supersedes the account, onboarding, listing and Scenario A blockers below. Do not repeat onboarding from this historical plan.

Scope: `rebuild-nextjs` at `d4bfabe`. Initial inspection was read-only; this evidence record is the only intended tracked change. No deployment, database mutation, provider transaction or account deletion was performed.

## Release assessment

SecondPart is substantially implemented, but is not signed off for public commerce or a production Android RC. Historical successful builds and static invariant checks are engineering evidence, not real payment, physical-device, legal or marketplace-liquidity sign-off.

The next P0 is **provider E2E preparation and execution**, beginning with dedicated Stripe test-mode seller onboarding. Do not rebuild the existing payment architecture. The immediately unblocked batch is local baseline verification and release-evidence reconciliation.

## Fresh live read-only evidence

Connected Supabase project: `secondpart` (`etkupijfdznljimrfyct`).

| Check | Result |
| --- | --- |
| Profiles with buyer role | 1; dedicated QA suitability not established |
| Active listings | 6 |
| Payout-ready seller accounts | 0 |
| Active listings attached to a payout-ready seller | 0 |
| Orders | 0 |
| Migration inspection | Accessible |
| Latest recorded migration | `20260911084129_confirm_checkout_paid_provider_guard` |
| `confirm_checkout_paid`, `cancel_checkout_order`, `get_releasing_payout_order_items` | SECURITY DEFINER; anon/authenticated execution false; service_role execution true |

Payout readiness counts require complete onboarding, transfers and payouts enabled, and a non-null provider account. These database counts do not establish Stripe credential mode or webhook configuration. Those must be checked in the intended deployment's admin preflight before any provider action.

## Conflicts and reproducibility risks

- `launch-readiness.md` says no buyer profile exists; the fresh aggregate is one. It does not prove that the account is disposable or available for QA.
- `pre-payments-roadmap.md` still lists checkout, webhook payment state, fulfilment, refunds and transfers as missing. Current routes, workers and migrations implement these; remaining release work is E2E proof. Its Preview-access blocker also predates the later public Preview smoke evidence in `launch-readiness.md`.
- Lowercase `product-decisions.md` describes deferred payments and an unspecified automatic-release period. Current launch policy and commerce runbook require explicit acceptance, a receipt-based protection window, or reviewed delivery evidence; silence alone never releases funds.
- `production-environment-matrix.md` still states that Supabase migration inspection is denied and payout recovery is pending. Live inspection succeeds and the migration is recorded. `validate-production-environment.mjs` explicitly requires those stale phrases, so its passing result does not prove current environment readiness.
- Git tracks both `docs/PRODUCT_DECISIONS.md` and `docs/product-decisions.md`. They contain different content and present a portability risk on case-insensitive checkouts. Preserve both documents' content when resolving the naming issue.
- Local migration version identifiers differ extensively from deployed identifiers. Four local identifiers occur twice: `20260906282000`, `20260906282500`, `20260907123500`, `20260907125000`. Live history records the corresponding named operations under distinct versions. Do not blindly push, replay, rename or repair migration history; reconcile definitions and ordering separately first.
- The high-level 1.0 checklist is entirely unchecked despite detailed historical engineering passes. Treat it as an unsigned aggregate gate, not proof that every feature is absent.

## Execution and verification plan

1. Establish the local dependency/build baseline; run diff check, lint, typecheck, build and all repository static validators. Record unavailable prerequisites separately from source failures.
2. Confirm available dedicated buyer/seller sign-in and Stripe **test mode**, intended webhook and HTTPS Preview origin. Complete seller onboarding through normal app/Stripe flows, then publish a QA listing normally. Never set readiness flags by SQL.
3. Execute commerce runbook Scenario A through actual test transfer evidence, then G (stock-one competition) and H (decline/retry/success). Record provider references and order/stock/audit outcomes without secrets.
4. Group cancellation, return/refund, dispute and reversal/recovery into a second provider batch. Run destructive account deletion only against an explicitly disposable configured QA account.
5. Close production origin, signing, Firebase, support and alerts before the Play-installed Android/FCM device batch. Keep legal review and real seller/inventory liquidity as separate release gates.

No application behaviour change is proposed in this audit. A later behaviour change requires Superpowers design workflow; a reproducible defect requires root-cause investigation and targeted regression evidence.

## Verification status

- `git diff --check`: passed after the audit record was added.
- All 14 `scripts/validate-*.mjs` scripts passed with exit code zero. These are static source/runbook invariant checks, not provider/device/destructive E2E execution.
- Installed locked dependencies with `npm ci --ignore-scripts --no-audit --no-fund` after retrying with network permission; the lockfile was not changed.
- `npm run lint`: exit 0; three unused-variable warnings in the legacy `mobile-shell` files.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0 using the same non-secret placeholder environment as branch CI. The first restricted-network attempt failed to fetch Google Fonts; retrying with network permission compiled and generated pages successfully without source changes.
- No fresh deployed browser, Stripe, Android, FCM, destructive deletion or legal sign-off was produced.
