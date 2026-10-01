# DVSA integration — 1 October 2026

## Scope and baseline

Work is on the existing `rebuild-nextjs`, based on `1d4fd279684ee8faf15fee23d9818efdc85382b0`. No main or Production changes. The owner confirms official DVSA approval; this is separate from credential configuration and live verification.

Existing architecture already supplies server-only registration lookup, web `/api/vehicle-lookup`, mobile `/api/mobile/v1/vehicle-lookup`, DfT catalogue resolution, hashed reduced-result cache and fail-closed database rate limiting. Garage actions authenticate the owner and scope writes to that owner; existing Garage RLS remains unchanged. No migration is required.

## Changes

- `src/lib/vehicle-registration.ts`: canonical server environment variables with legacy aliases retained; OAuth client credentials, single-flight acquisition and expiry-aware token reuse; eight-second deadlines and redirect rejection for both upstream calls; fixed official API origin and validated HTTPS Microsoft authentication host; strict registration/record matching and documented DVSA field projection; sanitized errors.
- `src/lib/platform-readiness.ts`: recognize canonical credentials and inferred provider; require scope as well as the other four inputs.
- `.env.example`: names and empty placeholders only.
- `src/components/vehicle-selector.tsx`: explicit Search again clears the lookup and catalogue choices; confirmation guidance explains the existing Use vehicle then Save to Garage flow. No automatic persistence.
- `scripts/test-dvsa-client.mjs`: synthetic provider tests, no real API usage.
- `scripts/test-vehicle-lookup-guidance.mjs`: reset regression coverage.
- `scripts/test-garage-ownership.mjs`: authenticated-owner insert, owner-scoped deletion and unauthenticated write rejection.
- `docs/product-decisions.md`: approval status updated without claiming provider activation.

Home and Garage retain the same selector. Add vehicle starts fresh. Saved catalogue selections feed the existing compatibility rules; checked and unchecked paths remain distinct. DVSA identity never proves part fitment. Android's hosted frontend and the existing mobile API use the server integration, without credentials in the client.

Official sources: [authentication](https://documentation.history.mot.api.gov.uk/mot-history-api/authentication/) and [OpenAPI](https://documentation.history.mot.api.gov.uk/mot-history-api/api-specification/mot_history_open_api_specification.yml). The response projection uses registration, make, model, manufactureDate/registrationDate/firstUsedDate, engineSize, fuelType and primaryColour; it omits raw MOT history. Engine ambiguity remains a catalogue/user decision.

## Verification

Targeted DVSA/selector/Garage/filter tests: 34 passed. Additional Garage ownership tests: 3 passed. Independent server review: 19 DVSA tests passed. Review found a reset discriminator typo, corrected to `kind: idle` before final checks.

Final full suite: **717 passed, zero failed**. `npm run lint`, `npm run typecheck`, `npm run build`, `npm run validate:mobile-performance` and `git diff --check` passed. Lint has zero errors and four pre-existing unused-variable warnings in legacy mobile/test files. Mock action tests establish owner scoping; they do not replace hosted cross-user RLS evidence.

## External gates

All five canonical variables are absent from this local process. No secret values were inspected or invented. Remote Preview variable presence has not been verified in this run. No working authenticated Vercel deployment tool is available here. No real DVSA request, responsive browser smoke or deployment of these changes is claimed.

Required next configuration in the existing project's **Preview** environment for `rebuild-nextjs`:

- `DVSA_CLIENT_ID`
- `DVSA_CLIENT_SECRET`
- `DVSA_API_KEY`
- `DVSA_SCOPE_URL`
- `DVSA_TOKEN_URL`

Use the exact values supplied by DVSA, without `NEXT_PUBLIC_` prefixes. Do not put secrets in chat, Git or this report. After configuration, deploy only Preview and verify a legitimate known registration through Home → confirm → save → Garage → select → both fit-filter settings, plus a different registration and supported mobile widths. Existing Preview address: https://second-part-shop-preview.vercel.app (not evidence of this revision).
