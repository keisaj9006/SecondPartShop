# DVSA → Garage repair and representative vehicle previews

Status: written design for owner review. The owner approved the conversational direction on 5 October 2026; implementation and hosted migration have not started.

## Outcome and scope

A successful official lookup must let a signed-in buyer save the real vehicle and select it immediately, even when its exact catalogue derivative is unresolved. Saved identity is not evidence of exact part compatibility. Repair this existing journey and its vehicle illustration only; do not start another general hardening package.

The owner's request is the source for the desired identity/fitment separation, duplicate handling, representative body/colour previews and manual acceptance criteria. Preserve the current regulated payment architecture, provider authority, checkout reservation protection and RLS. Never modify main or deploy Production. Never put credentials or signing material in source, logs or chat. Automated fixtures use synthetic registrations instead of publishing the owner's live registrations.

## Baseline and branch strategy

Canonical baseline: `aba0268d2bdf9e2f2a305838c535e78642b18f91`, including merged PRs #12–15. DVSA PR #10 was clean at `415227aa49cf67b4dd100fdc9e709c338dff0641`.

Update `codex/dvsa-integration` by an ordinary merge of `origin/rebuild-nextjs`, without rebasing or force pushing. This completed locally without conflicts in `4af9310`; all subsequent work must descend from that merge and contain the canonical baseline. Keep PR #10 open until the authenticated manual gate passes. Do not merge it just because automated tests pass.

## Confirmed causes

1. `VehicleSelector.canApply` requires variant ID/year, and the successful lookup is pushed into the manual catalogue chooser. The save continuation does not exist for identity-only results.
2. `saveGarageVehicle` returns silently when variant ID is absent. A read-only in-memory probe with valid identity returned no feedback and made zero database calls.
3. The deployed `garage_vehicles.catalogue_variant_id` is NOT NULL. Make/model are obtained exclusively through the catalogue join. Web/mobile reads use an inner join and drop rows without a variant.
4. The engine-control empty label means no loaded catalogue engine choices, not absence of DVSA engine capacity. Existing catalogue selection also restricts DfT body class to Cars; it cannot serve as a general identity requirement for a van.
5. A single passenger-car SVG is rendered for every vehicle. The existing palette already covers the requested colours; the rendering has no body-class resolver.
6. Active catalogue context exists in URL parameters and browser storage. No separate Garage default/active database column or rule was found. Four deployed Garage policies scope SELECT/INSERT/UPDATE/DELETE to `auth.uid() = profile_id`. The read-only inspection found zero current Garage rows; this is not permission to delete any future rows.

## Identity and fitment contract

Keep `garage_vehicles` as the single saved-vehicle table. Add bounded identity make/model fields and allow `catalogue_variant_id` to be NULL. Existing catalogue-backed rows remain valid without mandatory snapshot backfill. Keep registration, year, fuel, capacity, colour, nickname, timestamps and owner ID in their existing columns.

Identity-only rows require non-empty make/model, valid year and a normalized valid registration. Catalogue-backed manual vehicles continue to support no registration. Preserve engine/year/text bounds. Store official identity only from the server's existing `lookupVehicleByRegistration` result/cache; do not trust hidden client make/model values as a provider assertion. Do not persist raw MOT history. Missing provider identity fields are not invented; the action explains what is missing and retains the result/manual fallback.

The fitment status is derived, not a second writable authority: NULL variant means `needs_exact_variant`; a validated variant supplies the existing catalogue fitment context. A complete profile still does not guarantee that a particular part fits. Exact/family/buyer-verified/unverified outcomes remain the responsibility of existing evidence and compatibility functions.

Provider lookup failures at save must not create a provider-verified row or silently replace it with guessed data. Keep manual catalogue selection available; explicitly chosen manual data is validated against the catalogue and is not represented as DVSA-verified identity. Reuse the existing cache, provider deadlines and rate-limit defense for any save path that can invoke lookup, so saving cannot become an unrestricted alternate lookup endpoint.

### Migration and duplicates

Add a partial unique index on owner and normalized non-null registration. Inspect existing registration collisions and migration history before deployment; fail with a clear migration prerequisite rather than automatically deleting/merging rows. Preserve the existing composite uniqueness for unregistered catalogue vehicles and the catalogue FK for non-null values.

Use an atomic owner-scoped save operation (security invoker, fixed search path, authenticated role, RLS preserved) or equivalent unique-conflict recovery. Concurrent submissions must converge on the same Garage ID. Never accept a client-supplied owner ID. A duplicate lookup returns `already_exists`, selects the existing vehicle and says “Vehicle already in your Garage”. It must not overwrite an already confirmed fitment profile with a NULL variant. Attaching/updating an exact profile requires explicit confirmation and validated catalogue data for the same vehicle; never choose the first derivative arbitrarily.

Do not update global catalogue definitions or compatibility evidence to make the save succeed. Do not create a parallel vehicle table, artificial catalogue variant, new default-vehicle database concept or broad new vehicle settings system.

## Save and selection journey

Successful lookup displays its textual registration/make/model/year/fuel/capacity/colour and a clear enabled “Add to Garage” continuation for authenticated users. Saving is deliberate, not an effect triggered by lookup. Use action state to show saving, validation errors, retry and success/duplicate feedback; repeated clicks must not duplicate records. Signed-out users get the existing legitimate sign-in/return flow, without an auth bypass.

Return a saved Garage ID and navigate to the originating vehicle context. Home's existing add-vehicle entry and Garage's add link both use this result. Make/model/year/fuel/capacity/colour are not retyped after a successful lookup. The derivative chooser is optional for saving identity, required for checking exact fitment. Replace “Engine data unavailable” with context-aware wording such as “Choose an exact version to see catalogue engine options”; preserve DVSA capacity in the summary.

Use a private `gv` Garage ID in active context rather than placing a new private identity snapshot in a public query contract. Resolve it through the authenticated user's RLS-scoped read. Both Home and Garage derive the current selection through the same context helper. Invalid, removed or another owner's `gv` yields an explicit reselect state and never exposes registration/details or silently substitutes another vehicle.

Extend existing browser persistence for this ID, scoped to viewer identity. Do not restore an owner's private vehicle for another account or a signed-out viewer. Existing catalogue/manual `cv/cy/cf/ce` context remains supported. Public manually selected catalogue context can still be used without saving a Garage vehicle.

A newly saved/duplicate-selected vehicle becomes current. No default concept currently exists, so none is added; the first and later saves follow the same current-selection rule. Saved rows survive refresh and sign-out/in. The current private selection restores for the same account/browser according to the existing browser persistence approach, not as a promised cross-device default.

“Search again” clears the pending lookup/chooser state without deleting saved vehicles. “Remove selected vehicle” clears all active context parameters/storage together. Deleting a saved vehicle remains owner-scoped and cannot resurrect a stale current selection. Switching vehicles updates Home and Garage consistently; add mode never restores the previous vehicle into the new picker.

## Compatibility and checkout safety

For an identity-only selected vehicle, show “We found your vehicle. To check exact part compatibility, choose the exact version/engine.” Do not silently turn ON into make/model matching or a full-marketplace result set. With compatibility ON, show a controlled unresolved-profile state and no purported matching results. With OFF, explicitly show the broader marketplace, with fit unverified for this incomplete vehicle.

When an exact profile is explicitly selected, existing catalogue confidence rules and the ON/OFF behaviour resume. Vehicle existence, identity and representative body shape never supply fitment evidence.

Carry selected `gv` through listing/detail/search/checkout context and web/mobile checkout inputs. Resolve ownership/profile on the server. An incomplete, missing, unowned or unavailable selected Garage profile must fail before reservation/provider checkout; acknowledgement of a warning must not bypass missing profile validation. Selecting no vehicle remains the existing no-vehicle checkout path, without a fabricated fit claim. Preserve current family/unverified acknowledgement rules and provider/database authority for complete catalogue context. ON/OFF changes display filtering, not the safety of checkout validation.

## Representative vehicle preview

Keep `VehicleVisual` as the single rendering layer used by lookup results, Garage and Home selected cards. Add a small pure resolver shared by those callers. Initial supported shapes: hatchback, SUV, van, generic. Existing broad “Cars” catalogue classification is not a hatchback body style and must not override more specific information.

Resolver priority: supported specific structured body metadata → equivalent canonical metadata → explicit curated normalized make/model-family map → generic. Do not infer body style from arbitrary substring/free-text matching. Initial curated examples: Renault Trafic, Ford Transit and Volkswagen Transporter → van; Honda Jazz → representative hatchback; Nissan Qashqai → representative SUV. Ambiguous unmapped families remain generic. Structured estate/pickup/etc without an implemented shape use generic rather than the wrong shape. This is illustrative classification, never fitment evidence.

Use lightweight local SVG paths with consistent viewBox, responsive reserved dimensions, windows/wheels/outlines and no external image requests. The generic shape must be presented as unspecified rather than confidently model-correct. Normalize registration through the same registration helper; display it only when supplied from a permitted owner/explicit lookup context. Do not add private registration to public listing/seller pages, metadata, analytics or logs.

Reuse the controlled palette for white/light, grey, black/dark, blue, red, silver, green, yellow, orange and brown; unknown values are neutral. Keep contrast with windows/wheels/background. The preview is labelled representative in both compact and full modes, has a meaningful accessible name, and leaves essential identity available as text. It is not a photograph or exact model/paint-code claim.

## Expected code boundaries

- Migration under `supabase/migrations/`: optional variant, bounded identity, normalized owner-registration uniqueness and atomic save contract; existing RLS preserved.
- `src/lib/types.ts`, `src/lib/data/garage.ts`: identity-aware types, non-inner reads, owner-scoped ID lookup and row mapping.
- `src/app/garage/actions.ts`, `src/app/api/mobile/v1/garage/route.ts`: validated saves, duplicate handling, feedback, shared persistence contract.
- `src/components/vehicle-selector.tsx`: independent save continuation, truthful engine/fitment guidance, search-again/manual fallback.
- `src/lib/vehicle-context.ts`, `src/components/vehicle-context-persistence.tsx`, `src/components/garage-vehicle-use-control.tsx`: shared current context, viewer boundaries, removal and selection.
- `src/app/page.tsx`, `src/app/garage/page.tsx`, `src/components/marketplace-home.tsx`, search/detail/buy-form context consumers: resolve/display private selection without implicit matching.
- `src/app/checkout/actions.ts`, `src/app/api/mobile/v1/checkout/route.ts` and existing compatibility/context helpers: reject incomplete selected profiles before financial side effects.
- Pure preview resolver under `src/lib/` and existing `src/components/vehicle-visual.tsx`: deterministic body/colour mapping and local SVG.
- Regression scripts and canonical release evidence; no unrelated refactoring or new dependencies planned.

## Verification and release gates

Tests must first reproduce the observed identity-only save failure, missing save continuation and wrong van shape. Test real action/context/SQL behaviour rather than only checking source strings. Cover save/read-after-reload, active selection, no-new-default rule, case/space registration duplicates and concurrent duplicate submissions, explicit profile enrichment, manual fallback, search again, stale selection deletion, viewer changes, owner/other-user RLS, and no-variant filtering/checkout failure before reservation/Stripe. Include database fixtures for both existing catalogue rows and new identity-only rows. Use isolated databases and deterministic provider fixtures; do not fabricate successful live provider evidence.

Preview tests cover structured-source precedence, curated van/hatchback/SUV, unknown generic, requested colours, normalized/private registration, text identity, accessible names, compact/full representative notice, and no external image URLs. Independently review the migration, identity/fitment boundary, checkout guard, shared selection and privacy handling before merge.

Run focused and full tests; diff check, lint, typecheck, production web build, production dependency audit; all existing launch/commerce/Android validators; five-job QA and Android AAB dry run. CI signing/Firebase fixtures are not production signing or physical-device PASS. Verify migration history/target implications before any hosted schema change. If the target database also serves Production, stop for a separate explicit deployment decision; do not apply there under Preview-only authorization.

Publish one READY exact-head Preview only after validation. Smoke at 320, 390, 768 and 1440 px, including short height: no horizontal overflow, clipped controls, inaccessible CTA or SVG distortion. A scrollable result must keep the continuation discoverable, with clear feedback; do not claim native-keyboard/device proof from browser emulation.

Owner retest uses the two authorized registrations from the private request. Test A: lookup → save without forced derivative → current Home/Garage identity → refresh → ON unresolved guidance/OFF broader browse → duplicate → search again/manual path; select an exact variant only when actually known. Test B: legitimate Renault Trafic identity with grey representative van, correct text and registration. Read back ownership/persistence through authorized tools. The authenticated flow stays unsigned and PR #10 remains open until this passes. Never request credentials in chat.

## Alternatives rejected and residual risks

Only enabling the CTA cannot work with the current NOT NULL schema. Creating a fake derivative corrupts compatibility. A second Garage table splits ownership and selection semantics. An arbitrary family match hides uncertainty. A body-shape catalogue or external imagery adds unnecessary scope/network dependence. A new persisted default concept is not needed for this repair.

Residual risks requiring explicit checks: identity snapshot/cache mismatch; concurrent duplicate/enrichment loss; shared hosted database scope; private selection surviving account changes; incomplete context dropped on the way to checkout; unsupported van catalogue profile; and representative mappings mistaken for exact visual or fitment claims. None is closed by the existing 15 passing tests or by the written design alone.
