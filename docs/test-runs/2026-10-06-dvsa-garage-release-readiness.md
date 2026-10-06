# DVSA Garage repair — integrated QA checkpoint

Date: 2026-10-06
Branch: `codex/dvsa-integration`
Code/test head verified: `842847961d89205c63cdb41b51c8909c16c51176`  
Pull request: [#10](https://github.com/keisaj9006/SecondPartShop/pull/10), targeting `rebuild-nextjs` (open; not merged)

## Changes integrated

- Garage now supports bounded DVSA-backed identity-only records, normalized registration uniqueness, owner-scoped atomic save/enrichment, nullable catalogue profile and NULL-safe reads. Migration recovery is forward/corrective; it has not been applied to a hosted database.
- Vehicle context transitions through one helper. A selected Garage vehicle wins over conflicting manual catalogue parameters; account-scoped state, stale URL normalization, Back/Forward and removal behavior are covered.
- Successful DVSA identity results can be saved to Garage without forcing an exact derivative. Fit ON for identity-only vehicles fails closed; fit OFF browses with explicitly unverified labels.
- Vehicle visuals use controlled local SVGs and deterministic body/colour resolution; Renault Trafic resolves to a representative van.
- Web and mobile checkout resolve a selected Garage ID against the authenticated owner and ignore client fitment claims. Invalid/incomplete profiles stop before compatibility, seller payout sync, reservation or Stripe.
- Lockfile-only security follow-up upgrades `source-map-js` to 1.2.2 and vulnerable `brace-expansion` resolutions to 1.1.21/5.0.12. No direct dependency or product behavior changed.

## Verification on the code/test head

- `npm test`: 816 passed, 0 failed.
- `npm run lint`: 0 errors, 4 existing warnings in mobile shell and `test-mobile-buyer-orders.mjs`.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities after a clean `npm ci` from the committed lockfile.
- Full `npm audit --audit-level=high` still reports five high-severity developer-tool findings in the single `eslint-config-next@16.3.8` → `@next/eslint-plugin-next` → pinned `fast-glob@3.3.1` / `micromatch` / `braces@3.0.3` chain. The current Next lint package has no newer registry release, and `braces@3.0.4` is not available; npm's suggested `eslint-config-next@14.2.35` would be a major downgrade incompatible with this Next 16 app, so it was not applied. Track this upstream remediation before relying on untrusted patterns in development tooling.
- Repository validators passed: notifications, mobile performance, launch baseline, monitoring, commerce E2E harness, checkout-expiry race, payout recovery, Android RC, public contact, account-deletion E2E baseline, production-origin, production-env inventory, beta feedback and seller-read policy. Launch baseline still reports the documented external launch prerequisites.
- Exact-head GitHub QA run [37439387316](https://github.com/keisaj9006/SecondPartShop/actions/runs/37439387316): success on `842847961d89205c63cdb41b51c8909c16c51176`, including isolated PostgreSQL 17 Garage ownership/save serialization, stock concurrency, commerce/security validators and full CI checks.
- Exact-head Android production-style AAB run [37439392450](https://github.com/keisaj9006/SecondPartShop/actions/runs/37439392450): success on the same SHA using an ephemeral CI signing key and CI Firebase placeholder. This artifact is a dry-run proof, not a Play-uploadable production AAB.
- Independent code review found no actionable defects in the Garage, context, vehicle visual or checkout changes.

## Remaining release gates

- The hosted Garage migration is still unapplied. If the target Supabase database also serves Production, stop until its scope/backup/rollout gate is explicitly confirmed; do not restore `NOT NULL` or delete identity-only rows.
- Exact-head Preview deployment [842847961d89205c63cdb41b51c8909c16c51176](https://second-part-shop-l5owbljne-joannakwapis11-5369.vercel.app) is Ready. GitHub records the Preview deployment against this SHA; public GETs to `/`, `/garage` and `/account` returned HTTP 200, and `/` included the new identity-fit guidance with the old message absent. This is public route/render verification, not authenticated interaction testing.
- Browser QA remains: authenticated `SE66 PPO` lookup/save/reload/selection, unresolved fitment guidance, fit ON/OFF, duplicate, Search again/manual fallback; `MT71 JZG` with a representative grey van; responsive widths 320/390/768/1440 and short height; accessibility and no external image requests.
- No physical Android device/Play test, real Stripe transaction, production signing, Production deployment, or hosted migration was performed as part of this checkpoint.
- Do not merge PR #10 until the owner’s authenticated Preview retest is recorded. PRs #12–15 are currently merged and were not modified by this task.
