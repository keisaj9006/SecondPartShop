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

### Activation checkpoint — 5 October 2026

Supersedes the local-tool limitation below: official Vercel CLI 61.1.0 renewed the existing session. REST metadata (`decrypt=false`) confirms all five canonical variables are configured only for Preview, with no branch restriction. The values were not printed or pulled into a local environment file. No DVSA `NEXT_PUBLIC_` key was found in deployment environment names.

Fresh deployment from the unchanged PR #10 source SHA `8956e1b81d857abbf7b278455262a31e9d6e5643`:

- ID `dpl_DjMVuEkkuNKu97iCYrCYoovnUWdP`
- https://second-part-shop-krwydzwsg-joannakwapis11-5369.vercel.app
- branch `codex/dvsa-integration`, target Preview (`target=null`), READY
- deployment environment name list includes all five required DVSA names
- Home, Garage entry and `/api/mobile/v1/health`: HTTP 200; health `ok=true`, `backendReady=true`
- invalid `AB12!CDE` rejected by API HTTP 400 and actual UI with controlled guidance
- `agent-browser` restored real public UI testing; no horizontal overflow measured at 320/390/768/1440 px; Add vehicle opens an empty registration input and no inherited manual catalogue selection
- fresh focused tests: 44 passed; fresh [full QA](https://github.com/keisaj9006/SecondPartShop/actions/runs/37302662382) and [Android dry-run](https://github.com/keisaj9006/SecondPartShop/actions/runs/37302667530) succeeded

Live OAuth/vehicle response and signed-in DVSA → Garage remain **not verified**. Existing designated QA accounts have zero saved Garage registrations. A legitimate registration was requested from the owner; no value was invented and no valid-looking fake lookup was sent upstream. Keep PR #10 open until the provider and actual Garage regression gates pass. Repeated cached responses alone will not establish live token reuse.

[DVSA operations note](../dvsa-operations.md) covers caching, provider inactivity, rotation and safe outage handling. A separate Next.js patch repair (#11) merged into rebuild-nextjs as `d90c6122a5697fd84c6b2569984cfb2c10630f25` because the dependency audit found GHSA-vcvr-r3jv-pc5j. Bring that safe baseline into this PR and rerun regression before live verification; do not treat the older deployment/code boundary as public-launch approval.

### Historical 1 October boundary

All five canonical variables are absent from this local process. No secret values were inspected or invented. Remote Preview variable presence has not been verified in this run. No working authenticated Vercel deployment tool is available here. No real DVSA request, responsive browser smoke or deployment of these changes is claimed.

Required next configuration in the existing project's **Preview** environment for `rebuild-nextjs`:

- `DVSA_CLIENT_ID`
- `DVSA_CLIENT_SECRET`
- `DVSA_API_KEY`
- `DVSA_SCOPE_URL`
- `DVSA_TOKEN_URL`

Use the exact values supplied by DVSA, without `NEXT_PUBLIC_` prefixes. Do not put secrets in chat, Git or this report. After configuration, deploy only Preview and verify a legitimate known registration through Home → confirm → save → Garage → select → both fit-filter settings, plus a different registration and supported mobile widths. Existing Preview address: https://second-part-shop-preview.vercel.app (not evidence of this revision).
