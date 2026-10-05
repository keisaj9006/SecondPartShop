# Phase 2 — Vehicle Context report

Status: implementation complete; awaiting lead review. No Phase 3 or Phase 4 work is included.

## Contract delivered

Consumers should use `src/lib/vehicle-context.ts`:

- `setVehicleContext(params, selection)` is the single transition helper. Garage selection sets `gv` and clears `cv/cy/cf/ce`, legacy `vehicle/vr/vc`, and fitment state. Manual catalogue selection clears `gv` and legacy context. Clearing removes all competing vehicle state.
- `resolveVehicleContext` applies URL precedence deterministically: explicit Garage selection wins over conflicting manual fields; invalid/unowned Garage IDs fail closed; an explicit manual catalogue URL wins over stored Garage context; stale/partial context is normalized away.
- `parseVehicleContextStorage` accepts only the viewer-bound Garage-ID envelope. It rejects malformed, unscoped, and other-viewer state. The persisted context contains no vehicle identity/profile copy.

Home resolves a Garage ID with the Phase 1 owner-scoped `getGarageVehicleById(profileId, garageVehicleId)` and uses the Garage row's nullable `catalogueVariantId`. Identity-only rows remain selectable and are not promoted to catalogue fitment. Garage links and filter transitions preserve only `gv`; manual selection and removal use the canonical helper. The add-vehicle flow suppresses stale stored selection without deleting the viewer's saved context.

## Changed files

- `src/lib/vehicle-context.ts`
- `src/components/vehicle-context-persistence.tsx`
- `src/components/marketplace-home.tsx`
- `src/components/marketplace-filters.tsx`
- `src/components/marketplace-search.tsx`
- `src/components/vehicle-selector.tsx`
- `src/app/page.tsx`
- `src/app/garage/page.tsx`
- focused scripts under `scripts/test-*` for precedence, navigation, filters, Garage selection, and helper loader integration

## Verification

- Focused affected tests: 82/82 passed.
- Full `npm test`: 796/796 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 4 existing warnings in mobile-shell and mobile test files; 0 errors.
- `npm run build`: passed (Next.js 16.3.4 in this local worktree; lockfile-aligned CI remains the authoritative environment).
- `git diff --check`: passed.

## Residual risks / limits

- Viewer persistence is browser-local and scoped by authenticated viewer ID; it does not claim cross-device synchronization or introduce a Garage default column.
- Hosted schema changes, deployment, and production behavior were not exercised or changed.
- Full integrated adversarial checkout, mobile, and visual QA belongs to later gated phases and has not started.
- Lead review is required before dependent phases consume this contract.

Commit SHA: supplied to the lead with the final review handoff.
