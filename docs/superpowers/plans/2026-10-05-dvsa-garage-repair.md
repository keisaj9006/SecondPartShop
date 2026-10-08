# DVSA → Garage Repair and Vehicle Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let buyers save and select an officially found vehicle without an exact derivative while preserving honest fitment, safe checkout, Garage ownership and representative vehicle previews.

**Architecture:** Extend the existing Garage row with nullable catalogue fitment and a bounded identity snapshot. Centralize web vehicle-context transitions, validate Garage IDs under the signed-in user's RLS, and make saves/duplicate enrichment atomic in a forward-only migration. Reuse the existing compatibility/checkout guards and `VehicleVisual` with a deterministic local body resolver.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase/PostgreSQL migrations and RLS, Node `node:test` regression scripts, existing isolated PostgreSQL 17 CI jobs, Vercel Preview and Android release-check workflow.

**Spec:** `docs/superpowers/specs/2026-10-05-dvsa-garage-repair-design.md`

## Global Constraints

- Work on `codex/dvsa-integration`, which contains canonical `rebuild-nextjs` through PR #15; never force-push or modify `main`.
- Never deploy Production, perform a destructive rollback, delete/merge Garage rows, or automatically restore `catalogue_variant_id NOT NULL`.
- Preserve owner RLS on reads, writes and RPCs. Derive owner from `auth.uid()`; never accept an owner ID from client input.
- `gv` and `cv/cy/cf/ce` are mutually exclusive; `src/lib/vehicle-context.ts` is the sole owner of context transitions and normalization.
- Exact-profile enrichment must match normalized make/model/year and all reliable supplied fuel/capacity evidence; ambiguity/conflict stays identity-only.
- A confirmed non-NULL variant can never be downgraded by identity upsert, retry or concurrent write.
- A selected incomplete, invalid, stale or unowned Garage vehicle fails closed before checkout reservation/Stripe.
- Identity and body style never count as part-fitment evidence. Do not create an artificial derivative or update global fitment evidence.
- Use synthetic automated fixtures. Keep authorized live registrations out of test source, commits and logs.
- Stop hosted DDL if the Supabase target serves Production; validate the migration in an isolated PostgreSQL 17 database and request a separate deployment decision.
- No new dependencies, public registration exposure, raw MOT persistence, external illustration requests or unrelated hardening scope.

## Review Focus

- URL has a valid `gv` plus stale `cv/cy/cf/ce`; regression pins Garage precedence and ensures only `gv` reaches Home/listing/checkout.
- URL has malformed, deleted or another owner's `gv` plus a valid catalogue profile; regression requires explicit reselect and forbids silent fallback.
- Manual catalogue URL competes with a prior browser-stored Garage ID, or account identity changes; regression pins URL precedence and prevents cross-viewer restoration.
- Identity-only upsert races an exact-profile enrichment or two different enrichments; PostgreSQL regression proves a confirmed profile cannot be lost or guessed.
- Nullable Garage row has no catalogue join, a conflicting registered duplicate, or unknown body style; tests retain the row, reject conflict, and use neutral preview without fit claims.

---

### Task 1: Canonical vehicle-context transitions

**Files:**
- Modify: `src/lib/vehicle-context.ts`
- Modify: `src/components/vehicle-context-persistence.tsx`
- Modify: `src/components/vehicle-selector.tsx`
- Modify: `src/components/marketplace-home.tsx`
- Modify: `src/components/marketplace-search.tsx`
- Modify: `src/components/garage-vehicle-use-control.tsx`
- Test: `scripts/test-vehicle-context-precedence.mjs`
- Extend: `scripts/test-marketplace-navigation.mjs`

**Interfaces:**
- `VehicleContextSelection` is a discriminated union for `{kind:"garage", garageVehicleId, fitOnly}`, `{kind:"catalogue", variantId, year, fuel?, engine?, fitOnly}`, `{kind:"legacy", vehicleId, fitOnly}`, and `{kind:"none"}`.
- `setVehicleContext(params: URLSearchParams, selection: VehicleContextSelection): URLSearchParams` is the sole function that sets and clears `gv`, `cv/cy/cf/ce`, legacy `vehicle`, `vr/vc` and `fit` as appropriate.
- Canonical incoming resolution is owned by the same vehicle-context module. It reports a present-but-invalid `gv` as an explicit unresolved state; it never silently chooses a competing context.
- Resolution precedence: explicit current URL context wins over storage; present `gv` wins over coexisting catalogue parameters but is owner-validated before use; invalid `gv` fails closed and clears competing context; without `gv`, a valid manual catalogue URL wins over stored Garage state; legacy `vehicle` is considered only if both modern contexts are absent; stored context restores only for the same signed-in viewer; `addVehicle=1` suppresses restore.

- [ ] **Step 1: Add failing transition and precedence tests**

In `scripts/test-vehicle-context-precedence.mjs`, assert selecting Garage sets `gv` and removes `cv/cy/cf/ce/vehicle`; selecting catalogue removes `gv/vehicle` and sets exactly the specified catalogue fields; `none` removes all vehicle context. Assert conflicting valid `gv` + catalogue resolves only as Garage, invalid `gv` fails closed, manual URL clears stale stored `gv`, explicit URL wins over storage, add mode suppresses restore, and a viewer change cannot restore the previous viewer's ID.

Run: `node --test scripts/test-vehicle-context-precedence.mjs`

Expected: FAIL because the shared transition/resolver does not exist and consumers mutate parameter subsets independently.

- [ ] **Step 2: Implement the canonical transition in `src/lib/vehicle-context.ts`**

Add the discriminated union and a pure `setVehicleContext` that clones the input parameters, clears competing contexts in every branch and emits only the selected context. Add a single incoming-state normalizer/resolution result in this module with explicit URL/storage precedence and a fail-closed invalid-Garage state. Include the viewer ID in the stored-context envelope; never store Garage registration or make/model in that envelope.

- [ ] **Step 3: Route all existing web transition controls through the canonical helper**

Use the helper in vehicle selection, Garage selection, search vehicle removal and Home URL construction. `VehicleContextPersistence` must canonicalize Back/Forward and stale storage before writing/restoring and key Garage restoration to the authenticated viewer. Add `viewerId` where the server-to-client persistence component needs it. Keep add-vehicle mode isolated from previous context.

- [ ] **Step 4: Run the context regressions**

Run: `node --test scripts/test-vehicle-context-precedence.mjs scripts/test-marketplace-navigation.mjs scripts/test-marketplace-filter-vehicle-context.mjs`

Expected: PASS; each transition and restored URL contains at most one canonical vehicle context, while existing search/filter/pagination preservation still passes.

- [ ] **Step 5: Commit the context contract**

Commit: `refactor: centralize active vehicle context`

### Task 2: Nullable Garage identity schema and complete reads

**Files:**
- Create: `supabase/migrations/<UTC timestamp>_garage_vehicle_identity.sql` (choose a unique timestamp when implementation starts)
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data/garage.ts`
- Modify: `src/app/api/mobile/v1/garage/route.ts`
- Audit/modify: every `garage_vehicles` read/write found by `rg -n 'garage_vehicles|catalogue_variant_id' src supabase/migrations`.
- Test: `scripts/test-garage-identity-migration.mjs`
- Test: `scripts/test-garage-null-profile-reads.mjs`
- Create: `scripts/verify-garage-identity-postgres.mjs`
- Modify: `.github/workflows/rebuild-nextjs-qa.yml`

**Interfaces:**
- Extend `GarageVehicle` with non-null `make`, `model` identity values and nullable `catalogueVariantId`, `variant`; retain optional fitment metadata as nullable values.
- `getGarageVehicleById(profileId: string, garageVehicleId: string): Promise<GarageVehicle|null>` is owner-filtered and uses the caller's RLS-scoped server client.
- Web/mobile list readers use an optional catalogue relation and prefer catalogue make/model/variant when present, otherwise return the identity snapshot. Rows without a join are not dropped.

- [ ] **Step 1: Add migration and mapper regression fixtures**

The migration test asserts `catalogue_variant_id` becomes nullable without removing its FK, old catalogue rows stay representable, new identity fields are bounded, owner RLS remains enabled and no destructive statements or automatic `NOT NULL` rollback are introduced. Mapper tests pass one catalogue-backed row and one no-join identity-only row through web and mobile projections; both must be returned.

Run: `node --test scripts/test-garage-identity-migration.mjs scripts/test-garage-null-profile-reads.mjs`

Expected: FAIL because the migration and identity-only mappings are absent.

- [ ] **Step 2: Review migration history and write a forward-only migration**

Inspect current migrations and the target database's actual collision count immediately before choosing the partial unique registration index. Normalize using the same uppercase/whitespace-removal rule as `normalizeRegistration`. If registration collisions exist, make the migration fail with a clear corrective prerequisite; never pick/delete/merge a row. Drop only the `NOT NULL` attribute, add bounded identity columns/checks and owner-normalized-registration uniqueness, preserve FK/indexes/RLS/grants. Document recovery as a forward/corrective migration. Once identity-only rows exist, never restore `NOT NULL`, delete/merge those rows to satisfy an old constraint, or run a destructive rollback.

- [ ] **Step 3: Make every Garage read NULL-safe**

Update web/mobile row types, remove the Garage catalogue `!inner` relation, coalesce displayed identity from the optional joined catalogue or identity columns, and add the RLS-scoped by-ID reader. Audit all Garage FK dereferences, selected-profile lookup, direct SQL references and server actions; guard fitment-specific operations when the variant is NULL. Keep related non-Garage transaction/donor relations unchanged.

- [ ] **Step 4: Verify real PostgreSQL and ownership behaviour**

`verify-garage-identity-postgres.mjs` creates an isolated schema, applies the migration over the existing Garage migration fixture, inserts catalogue-backed and identity-only rows as two authenticated owners, verifies both read forms, and proves one role cannot select/mutate the other owner's row. Run in a dedicated PostgreSQL 17 CI service job, following the existing concurrency-verifier pattern and temporary `pg` install; never point `TEST_DATABASE_URL` at hosted data.

Run: `node --test scripts/test-garage-identity-migration.mjs scripts/test-garage-null-profile-reads.mjs` and `node scripts/verify-garage-identity-postgres.mjs` with the workflow's disposable `TEST_DATABASE_URL`/`PG_CLIENT_MODULE`.

Expected: PASS; both row shapes survive and cross-owner operations affect zero rows or return the existing safe authorization error.

- [ ] **Step 5: Commit schema and null-safe readers**

Commit: `feat: support Garage identity without a catalogue variant`

### Task 3: Atomic identity save, duplicate handling and safe enrichment

**Files:**
- Modify: the Task 2 migration with `public.save_garage_vehicle_v1`
- Modify: `src/app/garage/actions.ts`
- Modify: `src/app/api/mobile/v1/garage/route.ts`
- Modify: `src/lib/data/vehicle-catalogue.ts` only if a server-side comparison helper is needed.
- Modify: `src/lib/vehicle-registration.ts`/`src/lib/vehicle-lookup-operational.ts` only to reuse the existing guarded server lookup path.
- Test: `scripts/test-garage-identity-save.mjs`
- Extend: `scripts/test-garage-ownership.mjs`
- Extend: `scripts/verify-garage-identity-postgres.mjs`

**Interfaces:**
- Server entry accepts registration plus an explicit operation (`identity_save` or `enrich_exact`) and allowed user-editable optional fields. It derives the owner from `requireUser`; for a DVSA identity save it obtains identity from `lookupVehicleByRegistration`, using the existing cache, deadline and rate-limit protection, never hidden make/model inputs.
- RPC `public.save_garage_vehicle_v1(...)` returns `{garage_vehicle_id uuid, outcome text, catalogue_variant_id uuid|null}`. `outcome` is `created`, `already_exists`, `enriched`, or `reselect_required`. It derives the owner from `auth.uid()`, validates any supplied variant/year/fuel/capacity against catalogue tables, uses fixed search path and `SECURITY INVOKER`, and preserves existing RLS.
- Normalize make/model using the same uppercase alphanumeric comparison used by the existing catalogue matcher. A match requires make/model/year. When both sides provide fuel and engine capacity, they must match. Any conflict rejects; multiple candidates stay unresolved.

- [ ] **Step 1: Add failing web/mobile and PostgreSQL concurrency tests**

`test-garage-identity-save.mjs` asserts a valid provider result without variant reaches an explicit saved/duplicate result; absent/incomplete lookup returns actionable feedback and writes nothing; fabricated hidden make/model values are ignored; manual catalogue selection is still catalogue-validated. Extend Postgres fixtures for normalized `SE66PPO`/`se66 ppo` uniqueness, invalid/conflicting/ambiguous enrichment, owner isolation and two-connection races. Run an identity-only upsert concurrently with exact enrichment and assert the final variant remains non-NULL; run a second identity upsert afterward and assert it cannot downgrade the variant. Competing exact variants must leave no arbitrary winner.

Run: `node --test scripts/test-garage-identity-save.mjs scripts/test-garage-ownership.mjs`; run the PostgreSQL verifier against its disposable database.

Expected: FAIL on no variant, silent return, duplicate race or profile downgrade before implementation.

- [ ] **Step 2: Implement database atomicity and validation**

Add the owner-scoped RPC to the pending migration. Its identity-save conflict clause may update permitted identity/colour fields but must preserve any existing non-NULL variant. Exact enrichment updates only a still-NULL matching identity (or the same already-selected variant) and performs every server-reproducible catalogue comparison in the invoker function. Never trust a client-provided profile ID. Restrict execute to authenticated; fix search path and schema-qualify references.

- [ ] **Step 3: Implement server and mobile action outcomes**

The web server action checks the signed-in owner, validates registration, consumes the existing vehicle-lookup rate protection and calls the existing cached server provider lookup for DVSA-backed save. Manual exact-profile save resolves catalogue data server-side. The mobile route uses the same write contract and current mobile user. Map database/provider failures to retryable, safe action/API feedback; never return raw database/provider details. Preserve existing sign-in/return behaviour.

- [ ] **Step 4: Run save, RLS, duplicate and real PostgreSQL race regressions**

Run: `node --test scripts/test-garage-identity-save.mjs scripts/test-garage-ownership.mjs scripts/test-dvsa-client.mjs`; run the PostgreSQL verifier. Expected: PASS including normalized duplicates, ambiguous/conflicting no-enrichment, and no downgrade under both transaction orderings.

- [ ] **Step 5: Commit atomic save behaviour**

Commit: `feat: save Garage identity and enrich fitment atomically`

### Task 4: Identity-only lookup continuation and fitment state

**Files:**
- Modify: `src/components/vehicle-selector.tsx`
- Modify: `src/components/marketplace-home.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/lib/data/compatibility.ts`
- Modify: `src/components/vehicle-compatibility-toggle.tsx` only as needed to render the unresolved state.
- Test: `scripts/test-garage-identity-journey.mjs`
- Extend: `scripts/test-vehicle-lookup-guidance.mjs`
- Extend: `scripts/test-marketplace-filter-vehicle-context.mjs`

**Interfaces:**
- Lookup success shows DVSA identity fields and a deliberate enabled `Add to Garage` action independent of derivative resolution.
- A selected incomplete Garage identity carries `garageVehicleId` but no variant; Home/search show the explicit unresolved-profile state for fit ON and broader unverified results for fit OFF.
- Search-again/manual catalogue flows call the canonical context helper; save/duplicate returns the Garage ID to activate.

- [ ] **Step 1: Add failing journey and filter tests**

Assert successful identity-only lookup renders a usable CTA; save keeps DVSA capacity visible when catalogue engine options are empty; `Search again` resets lookup but leaves stored Garage rows; identity-only fit ON returns the controlled unresolved state and fit OFF returns the broad browse state. Assert no call to catalogue compatibility RPC claims an identity-only vehicle's fit.

Run: `node --test scripts/test-garage-identity-journey.mjs scripts/test-vehicle-lookup-guidance.mjs scripts/test-marketplace-filter-vehicle-context.mjs`

Expected: FAIL because the CTA currently depends on a catalogue selection.

- [ ] **Step 2: Add save action state and truthful identity/engine copy**

Connect the reviewed Task 3 save outcome to action state, pending/success/duplicate/error UI. Keep identity summary on-screen. Replace the misleading “Engine data unavailable” label with catalogue-specific guidance; do not erase the DVSA engine capacity or force a derivative just to enable saving.

- [ ] **Step 3: Add identity-only fitment routing**

Resolve `gv` through the owner-scoped Garage reader. When its variant is NULL, do not call catalogue matching with make/model or reinterpret it as legacy compatibility. Keep fit ON explicitly unresolved with no cards represented as fitting; fit OFF uses the existing full-marketplace path and its truthful unverified labels. Keep complete catalogue and legacy compatibility behaviour unchanged.

- [ ] **Step 4: Run focused journey tests**

Run: `node --test scripts/test-garage-identity-journey.mjs scripts/test-vehicle-lookup-guidance.mjs scripts/test-marketplace-filter-vehicle-context.mjs scripts/test-checkout-compatibility-fail-closed.mjs`

Expected: PASS; existing manual fallback and complete-catalogue fit tests remain green.

- [ ] **Step 5: Commit the identity journey**

Commit: `feat: let buyers save DVSA identity before fitment resolution`

### Task 5: Deterministic, viewer-scoped current Garage selection

**Files:**
- Modify: `src/lib/vehicle-context.ts` (canonical contract from Task 1 only)
- Modify: `src/components/vehicle-context-persistence.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/garage/page.tsx`
- Modify: `src/components/marketplace-home.tsx`
- Modify: `src/components/garage-vehicle-use-control.tsx`
- Modify: `src/components/marketplace-search.tsx`
- Test: `scripts/test-garage-active-context.mjs`
- Extend: `scripts/test-marketplace-navigation.mjs`
- Extend: `scripts/test-garage-fit-selection.mjs`

**Interfaces:**
- Web context resolution consumes canonical `VehicleContextSelection` and the authenticated owner. Private `gv` resolution uses `getGarageVehicleById` and returns a saved `GarageVehicle` or an explicit stale/unavailable state.
- Saving or selecting an existing duplicate sets `gv`, clears all competing modern/legacy vehicle parameters and persists the ID in a viewer-keyed envelope; no separate default column is introduced.

- [ ] **Step 1: Add failing save → current state/read-after-refresh tests**

Assert identity save navigates to the returned Garage ID, Home and Garage display the same identity after refresh, duplicate selection focuses the existing row, remove/delete clears the active ID, selecting another Garage record switches context, viewer change and sign-out clear prior Garage storage, and first/later vehicle selections follow the same rule without creating a `default` field.

Run: `node --test scripts/test-garage-active-context.mjs scripts/test-garage-fit-selection.mjs`

Expected: FAIL because there is no identity-only row or private Garage current context.

- [ ] **Step 2: Resolve and render the active Garage vehicle on both routes**

Use the shared by-ID reader and common identity mapping in Home and Garage. Owner-filter every lookup. A missing/deleted/other-owner ID clears or requires explicit reselection and never switches to a simultaneous catalogue context.

- [ ] **Step 3: Integrate viewer-scoped persistence and controls**

Extend the existing stored-context envelope to `{viewerId, selection}`. Write only after the authenticated viewer and active URL agree. Remove the stored context on sign-out, account switch, explicit clear, deleted selection or add mode. Keep URL as the explicit current navigation source; Back/Forward normalizes stale storage through Task 1.

- [ ] **Step 4: Run navigation, ownership and responsive-context regressions**

Run: `node --test scripts/test-garage-active-context.mjs scripts/test-garage-fit-selection.mjs scripts/test-marketplace-navigation.mjs scripts/test-garage-ownership.mjs`

Expected: PASS; Home/Garage agree and no context survives for an unrelated viewer.

- [ ] **Step 5: Commit active-selection behaviour**

Commit: `feat: share the current Garage vehicle across Home and Garage`

### Task 6: Propagate one context through listing, search and safe checkout

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/marketplace-home.tsx`
- Modify: `src/components/marketplace-search.tsx`
- Modify: `src/app/parts/[slug]/page.tsx`
- Modify: `src/components/buy-now-form.tsx`
- Modify: `src/app/checkout/actions.ts`
- Modify: `src/app/api/mobile/v1/marketplace/route.ts`
- Modify: `src/app/api/mobile/v1/listings/[slug]/route.ts`
- Modify: `src/app/api/mobile/v1/checkout/route.ts`
- Modify: related listing-page link builders only where tests show vehicle context is dropped.
- Test: `scripts/test-garage-context-checkout.mjs`
- Extend: `scripts/test-checkout-compatibility-fail-closed.mjs`
- Extend: `scripts/test-marketplace-navigation.mjs`

**Interfaces:**
- Server-resolved marketplace/detail props carry the same `VehicleContextSelection`; link builders call `setVehicleContext` and preserve the single active context.
- Web/mobile checkout accept `garageVehicleId` only as a selector; server actions resolve ownership and fitment fields from the RLS-scoped Garage row.
- Selected identity-only/unavailable Garage vehicle fails before `prepare_checkout_order_v2` or Stripe session creation. No selected vehicle preserves today's no-vehicle checkout path. Complete catalogue profiles preserve existing uncertainty acknowledgement and provider/database authority.

- [ ] **Step 1: Add failing context and checkout-boundary tests**

Assert Home pagination/search, listing/detail, Back-to-results and mobile marketplace/detail preserve exactly one context. In web/mobile checkout harnesses cover identity-only, malformed, stale, unowned and lookup-failed `gv`; assert return/error is controlled and both reservation RPC and Stripe call counts stay zero. Cover one valid complete Garage profile and no selected vehicle to prove existing paths remain.

Run: `node --test scripts/test-garage-context-checkout.mjs scripts/test-checkout-compatibility-fail-closed.mjs scripts/test-marketplace-navigation.mjs`

Expected: FAIL because current checkout accepts only catalogue fields and links do not know Garage ID.

- [ ] **Step 2: Carry canonical context through web pages and controls**

Use resolved server context for search, filters, pagination, part links, reports/back links and buy forms. Do not expose private Garage registration through public links or analytics; use the owner-checked ID and only include registration in the existing explicitly permitted checkout/audit contract after server resolution.

- [ ] **Step 3: Guard web checkout before side effects**

When `garageVehicleId` is selected, load it through the current user's RLS-scoped client. If absent, invalid, incomplete or unavailable, return existing controlled vehicle-verification guidance before payout sync/reservation/Stripe as appropriate. Pass only server-derived validated catalogue fields for a complete profile into the existing compatibility and reservation paths.

- [ ] **Step 4: Apply the same resolution/guard to mobile**

Accept and validate the optional selected Garage ID in mobile marketplace/detail/checkout. Authenticated mobile reads resolve it for the current user only. Keep unauthenticated catalogue browse behaviour; a supplied private `gv` never causes public profile lookup. Reject incomplete selected context before checkout reservation.

- [ ] **Step 5: Run web/mobile search and commerce regressions**

Run: `node --test scripts/test-garage-context-checkout.mjs scripts/test-checkout-compatibility-fail-closed.mjs scripts/test-marketplace-navigation.mjs scripts/test-marketplace-filter-vehicle-context.mjs`

Expected: PASS; no selected identity context creates a reservation, and complete-profile/no-vehicle paths still match existing contracts.

- [ ] **Step 6: Commit context propagation and checkout guard**

Commit: `fix: preserve selected Garage context and guard checkout`

### Task 7: Representative vehicle body and colour previews

**Files:**
- Create: `src/lib/vehicle-preview.ts`
- Create: `scripts/test-vehicle-preview.mjs`
- Modify: `src/components/vehicle-visual.tsx`
- Modify: `src/components/vehicle-selector.tsx`
- Modify: `src/app/garage/page.tsx`
- Modify: `src/components/marketplace-home.tsx`

**Interfaces:**
- `resolveVehiclePreview(input: {make: string; model: string; modelFamily?: string|null; structuredBodyType?: string|null}): {bodyType: "hatchback"|"suv"|"van"|"generic"; source: "structured"|"curated"|"generic"}` is pure and deterministic.
- `VehicleVisual` accepts the resolved body type/source plus existing textual identity, colour, registration and compact props; it renders local SVG and an explicit representative-description accessible label.
- Curated normalized pairs are `{make: "RENAULT", model: "TRAFIC"}` → van, `{make: "FORD", model: "TRANSIT"}` → van, `{make: "VOLKSWAGEN", model: "TRANSPORTER"}` → van, `{make: "HONDA", model: "JAZZ"}` → hatchback and `{make: "NISSAN", model: "QASHQAI"}` → SUV. Use the exact normalized tokens; do not rely on arbitrary substring matching.

- [ ] **Step 1: Add failing mapping, palette and rendering tests**

Assert structured supported body metadata wins, Renault Trafic/Ford Transit/VW Transporter resolve to van, Honda Jazz to hatchback, Nissan Qashqai to SUV, and unknown/ambiguous families to generic. Assert all requested colours map through the existing controlled palette and unknown is neutral; local SVG contains no external `href/src`; compact/full preview labels are representative and textual make/model/year remain available.

Run: `node --test scripts/test-vehicle-preview.mjs`

Expected: FAIL because no pure body resolver or body-specific paths exist.

- [ ] **Step 2: Implement the pure deterministic body resolver**

Normalize explicit make/model-family keys in a small literal map. Accept only whitelisted structured body types; map estate/pickup/unknown unsupported values to generic. Do not match arbitrary substrings or use `Cars` as hatchback evidence.

- [ ] **Step 3: Render shape-specific local SVG in `VehicleVisual`**

Add consistent viewBox paths for the four approved shapes. Keep existing colour palette and readable windows/wheels/outlines. Reserve responsive image height to avoid layout shift. Show normalized registration only in the already permitted lookup/owner Garage/selected-view context; do not add public seller/listing use of private plates.

- [ ] **Step 4: Integrate all preview callers and run viewport checks**

Pass the same resolver output to lookup summary, Garage and Home; render unknown bodies as neutral generic. Run the existing browser verification at 320, 390, 768 and 1440 px including short height. Expected: no horizontal overflow, clipped CTA, SVG distortion or external image request.

- [ ] **Step 5: Commit representative preview**

Commit: `feat: render representative vehicle body previews`

### Task 8: Full verification, release evidence and manual handoff

**Files:**
- Modify: `docs/launch-readiness.md`
- Create: `docs/test-runs/YYYY-MM-DD-dvsa-garage-repair.md`
- Modify: `.github/workflows/rebuild-nextjs-qa.yml` only for the isolated Garage PostgreSQL contract job.
- Review: all files from Tasks 1–7 and migration.

**Interfaces:**
- Evidence report records branch/base/commit, actual validations, Preview, test identities as synthetic where automated, migration target/scope, and every unsigned/manual criterion.
- Do not mark DVSA → Garage passed or merge PR #10 until the user completes its authenticated gate in Preview.

- [ ] **Step 1: Run focused and full validations**

Run focused scripts from Tasks 1–7, then `git diff --check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:launch-baseline`, `npm run validate:commerce-e2e`, `npm run validate:checkout-expiry-race`, `npm run validate:android-rc`, `npm run validate:account-deletion-e2e`, `npm run validate:seller-read-policy`, `npm run validate:dependencies` and `npm run build`.

Expected: all successful. Lint warnings, if any, are reported separately from errors. Run the full existing QA workflow and Android release/AAB dry run on the exact code head.

- [ ] **Step 2: Re-check migration/hosted scope before any hosted DDL**

Use read-only checks to confirm actual target project, all registered migration history, current Garage row/registration collision counts and target environment. Never query or print vehicle registration values. If the database serves Production, stop before hosted migration; keep the SQL migration tested only in isolated CI and report that the authenticated hosted save remains blocked pending a separate explicit deployment decision.

- [ ] **Step 3: Obtain independent review and fix required findings**

Review nullable read assumptions, context precedence, privacy/viewer isolation, migration forward/recovery safety, duplicate/enrichment concurrency and checkout's no-side-effect boundary. Fix material findings, rerun their regressions and required full checks.

- [ ] **Step 4: Publish and verify one exact-head Preview**

Wait for READY deployment matching the final code SHA. Smoke Home/Garage/lookup, sign-in return, context switches, filters ON/OFF, manual path, listing/back navigation and safe checkout failures. Check 320/390/768/1440 px and short height. No Production alias/promotion.

- [ ] **Step 5: Record gaps and provide the owner retest**

Record precise Preview URL/SHA and browser boundaries. Give Test A instructions for save/refresh/current selection/context precedence/duplicate/search-again/fit ON/OFF and Test B for Trafic/grey/van/text. Mark owner-authenticated save, provider evidence, hosted schema and phone-only behaviour only from actual evidence. Keep PR #10 open until the manual gate is reported complete.

- [ ] **Step 6: Commit final evidence**

Commit: `docs: record DVSA Garage repair verification`

## Plan self-review

- Spec coverage: identity/fitment split and save; nullable migration/read audit/forward recovery; normalized duplicate/save/enrichment concurrency; shared active context, explicit precedence/storage/viewer changes; fit ON/OFF and checkout guards; local representative body/colour preview; RLS; tests/review/CI/Preview and manual DVSA retest are assigned to Tasks 1–8.
- Step scan: each task has named files, a checkable regression command and expected result before/after its code change. No hosted destructive action is a plan step.
- Type consistency: Garage selection is identified by `garageVehicleId`; manual selection by `variantId` + `year` + optional fuel/engine; `setVehicleContext` is the shared transition used by every web control; save RPC returns `garage_vehicle_id/outcome/catalogue_variant_id` consistently.
- Review Focus: all five risks are explicitly pinned to tests in Tasks 1–3, 5–6.
- Proportion: the eight independently reviewable tasks correspond to the cross-layer steps already defined in the approved spec; none introduces a separate product subsystem.
