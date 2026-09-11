# Verified Fit catalogue migration contract — 11 September 2026

The newer catalogue RPC migrations defined `marketplace_catalogue_cursor_page_v1` and `marketplace_catalogue_distance_page_v2` against `public.verified_fit_feedback`, bypassing the canonical transaction-backed `private.valid_verified_fit_feedback` view introduced on 7 September.

## Before

`node --test scripts/test-verified-fit-sources.mjs` exited 1 with 1 failure and 0 passes before the repair migration existed. The failure was the intended missing-migration assertion: expected exactly one generated Verified Fit catalogue guard migration, found zero.

## After

Supabase CLI 2.117.0 generated `supabase/migrations/20260911211956_guard_catalogue_verified_fit_evidence.sql` via `supabase migration new guard_catalogue_verified_fit_evidence`. The migration reads the current definitions for only the two named public RPCs, requires exactly two function OIDs and two distinct target names, requires the raw source in each definition, and replaces `public.verified_fit_feedback` with `private.valid_verified_fit_feedback` through `execute replace(definition, ...)`.

`node --test scripts/test-verified-fit-sources.mjs` then exited 0 with 1 pass and 0 failures. The test resolves the effective definitions across ordered migration history and requires both targets to use only the canonical private evidence view.

## Scope and limitations

This run proves the repository migration contract only. It did not connect to or mutate Supabase, execute PostgreSQL, inspect deployed functions, call deployed catalogue RPCs, or perform a refund/return/dispute/provider E2E flow. Controller verification must cover SQL execution in the verified Preview project, read back both definitions, and safely inspect catalogue RPC responses.

Affected paths are the generated migration, `scripts/test-verified-fit-sources.mjs`, this run record, and the corresponding SDD task report. Controller integration adds the `npm test`/`test:verified-fit` commands in `package.json` and replaces the individually listed CI test commands with `npm test` in `.github/workflows/rebuild-nextjs-qa.yml`, retaining every existing test and validator.

Independent review found that the initial contract test simulated both replacements from the migration filename. The corrected test extracts targets from the actual replacement loop and adds two negative mutation cases: leaving each name in the count query while removing it from the loop must fail validation. No database change was applied before this review correction.

No data rollback is required. Emergency rollback consists of recovering and reapplying both prior function definitions from git, with the explicit consequence that this restores the defective raw feedback source. Prefer a corrected forward migration whenever possible.

## Controller verification

- Independent review: approved after correcting the contract-test false-green gap.
- Release batch tests: all 23 pass (20 existing plus 3 Verified Fit contract/mutation cases). The later photo batch's uncommitted red tests are outside this commit.
- `git diff --check`, lint, sequential typecheck and full build pass. Lint retains three existing unused-variable warnings in `mobile-shell`. An earlier concurrent build/typecheck attempt raced on generated `.next/types`; the separate typecheck passed after the build finished. CI runs these sequentially.
- All 14 existing release/security/commerce/privacy/monitoring validators pass. These are repository validators, not new provider E2E claims.
- Preview database project: `etkupijfdznljimrfyct`. Migration applied successfully through the Supabase migration API; recorded live version `20260911213317`, name `guard_catalogue_verified_fit_evidence`. The CLI-generated repository version is `20260911211956`; preserve this explicit mapping rather than replaying or repairing historical versions.
- Post-apply readback for both RPCs: `raw_feedback=false`, `valid_feedback=true`, `STABLE`, `SECURITY DEFINER`, empty `search_path`; both existing anon/authenticated execute grants and signatures are preserved.
- Read-only cursor and nearest-distance calls for the selected QA vehicle with compatible-only enabled returned zero rows before the change. Post-apply full-marketplace calls returned three rows each, all `unverified`. SQL execution succeeds without fabricated compatibility. This is a smoke check, not a refund/dispute fixture test.
- Commit, CI and Preview publication are recorded in the marketplace audit checkpoint after this batch is pushed.
