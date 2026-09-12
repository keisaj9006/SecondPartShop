# Photo recovery QA — 12 September 2026

Status: local runner and synthetic checks PASS; actual recovery **BLOCKED**, not executed.

The reviewed recovery-only runner prepares two unattached PNG orphan paths on the existing unpublished QA fixture. It exercises the real exact-path worker, a controlled removal failure and a suppressed acknowledgment followed by actual absent-object removal. It never invokes Auth, payments, broad maintenance, metadata deletion or account deletion.

Independent review found a Request-object method-classification bypass in the runner's fetch guard. Non-string inputs are now rejected before classification; the exact attempted PUT regression proves zero forwarding. Re-review approved the bounded runner. Focused tests: 105 passed (67 runner and 38 existing photo tests). Full suite: 175 passed. Lint/typecheck/build and all 14 validators passed; the final guard-only change additionally passed targeted lint, full tests and diff checks.

## Fresh Preview preflight and blocker

- App HEAD `742ff19b7ed4e64675494eb2218d3b1e050066b3`, CI `34689346343` succeeded. READY deployment `dpl_32er8P79F6pg3KGpwnihRzBQ8fH4`, `second-part-shop-df793zcrn-joannakwapis11-5369.vercel.app`; both Preview aliases matched.
- The eight deployed cleanup/attachment/upload function definitions and applicable Storage policies were read and reviewed. Exact owned paths, parent/path locks, durable authority, retired-path guards and restrictive authenticated UPDATE/DELETE policies remain intact. No migration or policy change was made.
- Fixture `760fdafa-e589-449e-9296-397f76c74bd2` remains the existing QA Seller draft. After Task 6 it has three synthetic photos, 325-pence price, 90-day warranty and no fabricated compatibility. Existing outbox: one completed tombstone, zero pending.
- Vercel CLI 59.16.0 rejected `env pull --id` for the READY deployment because that option required INITIALIZING state. A subsequent explicitly scoped `preview` / `rebuild-nextjs` configuration pull matched the intended Supabase project. This was current branch configuration, not an immutable deployment-secret snapshot.
- The necessary service key was returned only as `[SENSITIVE]`. No usable minimal runner configuration was written. The temporary raw configuration file was removed without printing values. No runner execution, new orphan upload, failure injection, Storage removal or acknowledgment occurred.

## Remaining gates

- Actual controlled provider recovery and absent-object retry require a trusted runtime already provisioned with the Preview service credential. Do not paste secrets into chat, expose an application debug endpoint, weaken variable protection or call broad maintenance to bypass this blocker.
- Authenticated-owner HTTP DELETE/UPDATE/upsert and retired-key INSERT remain manual: no verified ordinary QA session can be supplied to the local runner without additional Auth/session assumptions. The existing SQL policy plan is not an HTTP PASS.
- Committed concurrent outcomes and two-session connector behavior remain manual. The connector did not establish concurrent backends; PGlite is single-connection and cannot replace this evidence.
- Automatic Preview scheduling, broad maintenance-route recovery and disposable account deletion remain separate provider/RC checks.

Existing QA identities, Moira, the sold payment fixture and completed Stripe transaction were untouched. Continue the approved search completeness/sort P1 while these external prerequisites remain blocked.
