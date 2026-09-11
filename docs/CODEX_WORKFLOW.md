# SecondPart — Codex Workflow

## Goal

Continue SecondPart safely without losing context, breaking marketplace invariants, or declaring release readiness prematurely.

## Standard loop

### 1. Inspect

Read:
- `AGENTS.md`
- relevant context-pack docs
- relevant specialist repo docs
- current files
- migrations
- recent commits

Do not infer behaviour from filenames alone.

### 2. Classify

Use Superpowers task classification.

Examples:
- bug -> systematic debugging
- small existing-flow change -> bounded
- new domain model / payment architecture / major compatibility restructuring -> architectural

### 3. Establish acceptance criteria

Write concrete success conditions.

For a compatibility change, include:
- buyer-visible state,
- server-side enforcement,
- fallback behaviour,
- existing fitment preservation.

For commerce:
- order state,
- provider state,
- stock state,
- payout state,
- idempotency,
- retry/race behaviour.

### 4. Implement safely

Rules:
- smallest viable scope,
- no secret exposure,
- no RLS weakening,
- migration-driven DB changes,
- backward/data compatibility considered,
- server authority for protected actions,
- no client-only security guarantees.

### 5. Test

Baseline:
```bash
git diff --check
npm run lint
npm run typecheck
npm run build
```

Add targeted validators.

Use provider/device testing only when prerequisites are configured.

### 6. Review diff

Inspect:
- unintended files,
- generated artifacts,
- environment leakage,
- accidental branch changes,
- risky schema changes,
- broken fallback behaviour.

### 7. Verify

Do not say "done" until checks have actually passed.

For external integrations, distinguish:
- code ready,
- sandbox configured,
- E2E proven,
- production configured.

These are not interchangeable.

### 8. Report

Always report:
- scope,
- root cause / design reason,
- files,
- migrations,
- checks,
- blockers,
- residual risks,
- next task.

## Commerce-specific checklist

Before modifying payments:
- read current commerce runbooks,
- understand Stripe/provider authority,
- preserve idempotency,
- preserve stock reservation,
- preserve terminal-state guards,
- preserve reconciliation path,
- preserve payout safety.

Never manually invent "successful" provider state in DB for convenience.

## Supabase checklist

- inspect ordered migrations,
- maintain RLS,
- keep service-role server-only,
- verify function grants,
- consider existing data,
- do not use an outdated prototype migration.

## Compatibility checklist

Ask:
- what evidence produces this state?
- could family/model similarity be mistaken as confirmed?
- is the buyer's vehicle sufficiently resolved?
- what happens when external vehicle data is unavailable?
- does server-side checkout trust the same logic?

## Mobile checklist

Validate:
- responsive layout,
- persistent navigation,
- selected vehicle state,
- back behaviour,
- file/camera inputs,
- network recovery,
- external auth/payment return,
- app links.

## Performance checklist

Avoid:
- unbounded listing loads,
- client filtering over huge datasets,
- repeated vehicle-provider calls,
- N+1 seller/fitment lookups,
- loading 1,000+ listings at once.

Preserve keyset/bounded pagination patterns already in the codebase.
