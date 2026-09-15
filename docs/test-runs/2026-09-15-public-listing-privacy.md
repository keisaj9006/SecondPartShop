# Public listing privacy projection — 2026-09-15

## Scope

This evidence covers the public mobile marketplace/listing JSON projection on `rebuild-nextjs` Preview. It verifies that buyer-facing listing data remains available while internal import/donor/provenance identifiers are not serialized publicly.

Public routes in scope:

- `GET /api/mobile/v1/marketplace`
- `GET /api/mobile/v1/listings/[slug]`

No Production environment or real customer data was used.

## Finding

The pre-fix `toPublicListing()` spread the full internal `Listing` object and only nulled the seller postcode. Public JSON therefore exposed internal fields including:

- `donorVehicleId`
- `sourceChannel`
- `sourceExternalId`
- `importBatchId`

The listing-detail response also exposed fitment vehicle provenance:

- `dataStatus`
- `sourceReference`

For CSV inventory, `sourceExternalId` can represent a seller-side stock/reference value and `importBatchId` is an internal batch identifier, so these do not belong in the anonymous buyer projection.

## TDD RED

A regression test was added at `scripts/test-public-listing-privacy.mjs` and executes the real `src/lib/public-listing.ts` projection. The fixture includes the known internal fields plus synthetic future-private fields at listing, category, seller, image, fitment, vehicle and compatibility levels.

The first harness iteration failed lint and was not accepted as RED evidence. After correcting only the test harness, with production code unchanged:

- RED SHA: `64f8366894454dea4baeebdcb97eec9ac8592fe3`
- GitHub Actions run: `35008575376`
- lint: PASS
- typecheck: PASS
- `npm test`: FAIL as intended
- tests: 545
- pass: 544
- fail: 1
- failing assertion: `public listing must not expose donorVehicleId`

This demonstrated the privacy defect before the production fix.

## Fix

Production fix:

- SHA: `37940ae7d586d7657c824b632aed1528e20a9111`
- commit: `fix: minimize public listing payload`

`src/lib/public-listing.ts` now uses an explicit allowlisted projection. It no longer spreads the internal `Listing` object or nested seller/category/image/fitment/vehicle/compatibility objects into the public response.

Removed from the public listing projection:

- `donorVehicleId`
- `sourceChannel`
- `sourceExternalId`
- `importBatchId`

Removed from public fitment vehicles:

- `dataStatus`
- `sourceReference`

The existing public seller contract is preserved, including `ownerId`, while `postcode` remains explicitly `null`.

Buyer-facing data remains projected explicitly, including listing identity/slug/title/description, manufacturer and part/OEM numbers, gearbox context, condition, price/shipping/stock, dispatch/testing/warranty, public seller data, category data, image metadata, public vehicle fitment fields, fitment notes, compatibility summary and distance fields where present.

## GREEN CI

GitHub Actions run `35008872581` on exact SHA `37940ae7d586d7657c824b632aed1528e20a9111` completed successfully.

Relevant evidence:

- `git diff --check`: PASS
- lint: PASS (0 errors; pre-existing warnings only)
- typecheck: PASS
- `npm test`: PASS — 545/545, 0 failures
- privacy regression: `public listing projection removes internal listing and fitment provenance while preserving buyer-facing data` — PASS
- release validators: PASS
- Next.js production build: PASS
- true two-connection last-stock concurrency job: PASS
- isolated 100,000-listing PostgreSQL marketplace scale job: PASS

## Exact Preview verification

Vercel deployment:

- deployment: `dpl_8pY6HUNC1kb67wsrqfTWXiiQGc3N`
- URL: `https://second-part-shop-ljrh4lfcc-joannakwapis11-5369.vercel.app`
- state: READY
- Git SHA: `37940ae7d586d7657c824b632aed1528e20a9111`

Live anonymous `GET /api/mobile/v1/marketplace` returned 200 and no longer contained `donorVehicleId`, `sourceChannel`, `sourceExternalId` or `importBatchId`. Buyer-facing fields including title, seller public fields, price, stock and part/OEM numbers remained present.

Live anonymous `GET /api/mobile/v1/listings/dq250-complete-gearbox-02e-qa-offer` returned 200. Its fitment vehicle objects retained make/model/generation/year/engine/engineCode/fuel/gearbox fields and notes but no longer contained `dataStatus` or `sourceReference`.

Runtime smoke on the exact deployment after those requests:

- error/fatal logs: 0
- 5xx requests: 0

## Boundary

This evidence verifies the public listing serialization boundary for the two current mobile public listing endpoints and future-field leakage resistance of the shared explicit projection. It does not claim that unrelated HTTP security headers/CSP have been hardened; that is a separate review/change boundary.
