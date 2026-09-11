Use Superpowers for this task.

You are continuing development of **SecondPart** in repository `keisaj9006/SecondPartShop`.

Work only on branch:

`rebuild-nextjs`

Do not modify `main`.

Before changing code:

1. Read `AGENTS.md`.
2. Read `SECOND_PART_CODEX_MASTER_CONTEXT.md`.
3. Read:
   - `docs/CURRENT_STATE.md`
   - `docs/PRODUCT_DECISIONS.md`
   - `docs/DECISION_CONFLICTS.md`
   - `docs/ROADMAP.md`
   - `docs/SECOND_PART_1_0_CHECKLIST.md`
   - `docs/CODEX_WORKFLOW.md`
   - `docs/RESEARCH_INSIGHTS.md`
4. Inspect the current repo, latest commits, migrations and the existing canonical documents, especially:
   - `docs/launch-readiness.md`
   - `docs/pre-payments-roadmap.md`
   - `docs/product-decisions.md`
5. Treat current code + current repo documentation as source of truth.
6. Treat Deep Research as strategic evidence, not automatic implementation instructions.

Start with a **read-only audit**.

Determine:
- the true current release state,
- the highest-priority unblocked P0/P1 item,
- any contradiction between code, canonical docs and this context pack,
- whether the next task is coding, provider E2E, device QA, release configuration, or marketplace-liquidity work.

Do not redesign already-working systems just because Deep Research proposes a theoretically cleaner architecture.

For bugs, use systematic debugging.
For behavioural changes, follow Superpowers brainstorming/design approval requirements.
For implementation, use tests and verification appropriate to the changed subsystem.

Preserve all existing safety guarantees around:
- RLS,
- checkout reservations,
- Stripe provider authority,
- payout release,
- account deletion,
- inventory,
- fitment confidence,
- Verified Fit,
- Android release integrity.

Before claiming completion, run appropriate checks. For normal web changes at minimum:

`git diff --check`
`npm run lint`
`npm run typecheck`
`npm run build`

Run relevant targeted validators for commerce, Android, monitoring, notifications, account deletion, seller policy, production environment, etc.

Work in small verified batches.
Do not ask the user to manually test every tiny change. Accumulate manual-device/provider checks into clearly defined release/QA batches where safe.

After the initial audit, report:
1. current state,
2. highest-priority next task,
3. why it is the correct next task,
4. whether it is blocked by external credentials/accounts,
5. proposed execution plan,
6. verification plan.

Then continue according to the Superpowers workflow.
