# Phase 2 — Vehicle Context report

Status: implementation complete; awaiting lead review. No Phase 3 or Phase 4 work is included.

## Contract delivered

Consumers should use `src/lib/vehicle-context.ts`:

- `setVehicleContext(params, selection)` is the single transition helper. Garage selection sets `gv` and clears `cv/cy/cf/ce`, legacy `vehicle/vr/vc`, and fitment state. Manual catalogue selection clears `gv` and legacy context. Clearing removes all competing vehicle state.
- `resolveVehicleContext` applies URL precedence deterministically: explicit Garage selection wins over conflicting manual fields; invalid/unowned Garage IDs fail closed; an explicit manual catalogue URL wins over stored Garage context; stale/partial context is normalized away.
- `readStoredVehicleContext` accepts only the viewer-bound Garage-ID envelope. It rejects malformed, unscoped, and other-viewer state. The persisted context contains no vehicle identity/profile copy.

Home resolves a Garage ID with the Phase 1 owner-scoped `getGarageVehicleById(profileId, garageVehicleId)` and uses the Garage row's nullable `catalogueVariantId`. Identity-only rows remain selectable and are not promoted to catalogue fitment. Garage links and filter transitions preserve only `gv`; manual selection and removal use the canonical helper. The add-vehicle flow suppresses stale stored selection without deleting the viewer's saved context.

## Changed files

- `src/lib/vehicle-context.ts`
- `src/components/vehicle-context-persistence.tsx`
- `src/components/garage-vehicle-remove-form.tsx`
- `src/components/vehicle-compatibility-toggle.tsx`
- `src/components/marketplace-home.tsx`
- `src/components/marketplace-filters.tsx`
- `src/components/marketplace-search.tsx`
- `src/components/vehicle-selector.tsx`
- `src/app/page.tsx`
- `src/app/garage/page.tsx`
- `src/app/garage/actions.ts`
- focused scripts under `scripts/test-*` for precedence, navigation, filters, Garage selection, removal ownership, and helper loader integration

## Verification

- Focused affected tests: 82/82 passed.
- Full `npm test`: 796/796 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 4 existing warnings in mobile-shell and mobile test files; 0 errors.
- `npm run build`: passed (Next.js 16.3.4 in this local worktree; lockfile-aligned CI remains the authoritative environment).
- `git diff --check`: passed.

## Lead review follow-up

Two integration gaps were fixed in a follow-up: the compatibility toggle now routes ON/OFF fit changes through `setVehicleContextFit`, which resolves then rewrites one canonical context; Garage removal uses an owner-scoped server action that confirms the deleted row and returns success, after which the client clears storage only when its viewer-bound selected Garage ID matches the removed row. Failed deletes and deletion of another row preserve the stored selection.

Regressions now cover conflicting `gv` plus `cv/cy/cf/ce` and legacy parameters through both toggle directions, and selected/nonselected/failed Garage deletion.

Follow-up validation: focused context/Garage tests 23/23; typecheck passed; lint passed with the same 4 warnings and no errors; production build passed; diff check passed. The earlier full suite on the base Phase 2 commit was 796/796. Follow-up commit SHA is supplied to the lead with this report.


A third review finding was fixed: URL normalization now clears its in-flight destination marker after that canonical URL is observed. The integration regression simulates stale/conflicting URL → canonical replace → canonical landing → Back to the identical stale URL, and verifies the same canonical replace happens again. Focused Phase 2 suite after this fix: 87/87 passed; typecheck passed; diff check passed. No product or server contract changed.## Residual risks / limits

- Viewer persistence is browser-local and scoped by authenticated viewer ID; it does not claim cross-device synchronization or introduce a Garage default column.
- Hosted schema changes, deployment, and production behavior were not exercised or changed.
- Full integrated adversarial checkout, mobile, and visual QA belongs to later gated phases and has not started.
- Lead review is required before dependent phases consume this contract.

Commit SHA: supplied to the lead with the final review handoff.
