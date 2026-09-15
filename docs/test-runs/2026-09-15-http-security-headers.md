# SecondPart HTTP security headers and CSP evidence — 2026-09-15

## Scope and approved design

This hardening was performed only on `rebuild-nextjs` and Vercel Preview. The approved bounded design was a centrally enforced static CSP plus standard HTTP security headers, without changing the existing rendering architecture.

The policy intentionally keeps Next.js-compatible inline script/style execution for this RC rather than introducing nonce/hash CSP immediately. Production does not receive `unsafe-eval`; local development may use it for the Next.js development runtime. Vercel Toolbar domains are allowed only when `VERCEL_ENV=preview`.

Stripe browser domains are deliberately absent from the CSP. SecondPart's Stripe Checkout and recipient/onboarding integrations are server-side; the browser navigates to provider-returned external URLs instead of embedding Stripe.js or provider iframes.

Supabase is explicitly allowed for browser HTTPS and WSS traffic because the browser client uses the configured Supabase project. Product-image rendering also permits that same configured Supabase origin.

## TDD RED

Test commit:

- SHA `ee327f8f5153e34917eb56c0eaa9f1654e230146`
- message `test: require hardened HTTP security headers`
- test file `scripts/test-security-headers.mjs`
- GitHub Actions run `35017811163`

The RED run reached the intended test boundary:

- lint: PASS
- typecheck: PASS
- `npm test`: **545 PASS / 3 FAIL**
- all three failures were the new security-header tests and failed because the existing `next.config.ts` did not yet define a central `headers()` policy: `next.config.ts must define a central headers() policy`.

The concurrency and 100k marketplace-scale jobs remained green during the RED commit. No production code had been changed at that point.

## GREEN implementation

Production-code commit:

- SHA `a4e642f21dd112590da1360bda3426ed9b746803`
- message `security: enforce CSP and response headers`
- changed production file: `next.config.ts`

The implementation derives the configured Supabase HTTPS/WSS origins and builds a single global `/:path*` response-header policy.

The enforced headers are:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(self), geolocation=(self), microphone=()`

### Production CSP contract

Production is tested to require:

- `default-src 'self'`
- `base-uri 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`
- `form-action 'self'`
- `script-src 'self' 'unsafe-inline'`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob: <configured Supabase HTTPS origin>`
- `font-src 'self' data:`
- `connect-src 'self' <configured Supabase HTTPS origin> <configured Supabase WSS origin>`
- `worker-src 'self' blob:`
- `manifest-src 'self'`
- `media-src 'self' blob:`
- `frame-src 'none'`

The production regression explicitly rejects:

- `unsafe-eval`
- Vercel Toolbar domains
- Stripe domains
- blanket wildcard sources

### Preview-only exceptions

Preview additionally allows the Vercel Toolbar's documented resources:

- `script-src`: `https://vercel.live`
- `style-src`: `https://vercel.live`
- `img-src`: `https://vercel.live https://vercel.com`
- `font-src`: `https://vercel.live https://assets.vercel.com`
- `connect-src`: `https://vercel.live wss://ws-us3.pusher.com`
- `frame-src`: `https://vercel.live`

These exceptions are not part of the tested Production CSP.

## Full GREEN verification

GitHub Actions run `35017996830` completed successfully for exact SHA `a4e642f21dd112590da1360bda3426ed9b746803`.

Results:

- diff check: PASS
- lint: PASS (existing warnings only; zero errors)
- typecheck: PASS
- `npm test`: **548 / 548 PASS**
- notification validator: PASS
- mobile-performance validator: PASS
- launch-baseline validator: PASS
- monitoring validator: PASS
- commerce E2E validator: PASS
- checkout-expiry-race validator: PASS
- payout-recovery validator: PASS
- Android RC validator: PASS
- public-contact validator: PASS
- account-deletion E2E validator: PASS
- production-origin validator: PASS
- production-environment validator: PASS
- beta-feedback validator: PASS
- seller-read-policy validator: PASS
- production build: PASS
- true two-connection last-stock PostgreSQL concurrency job: PASS
- isolated 100,000-listing PostgreSQL marketplace-scale job: PASS

The three new permanent tests passed:

1. Production remains restrictive and allows only app + configured Supabase browser traffic.
2. Preview adds only the documented Vercel Toolbar exceptions.
3. Local development alone may enable `unsafe-eval`.

## Exact Preview evidence

Exact deployment:

- deployment `dpl_AFqNqXcToNZeTsiPz6B8LcqBx7AC`
- URL `https://second-part-shop-kkv4ru5gp-joannakwapis11-5369.vercel.app`
- exact SHA `a4e642f21dd112590da1360bda3426ed9b746803`
- state `READY`

Observed Preview CSP:

`default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://vercel.live; style-src 'self' 'unsafe-inline' https://vercel.live; img-src 'self' data: blob: https://etkupijfdznljimrfyct.supabase.co https://vercel.live https://vercel.com; font-src 'self' data: https://vercel.live https://assets.vercel.com; connect-src 'self' https://etkupijfdznljimrfyct.supabase.co wss://etkupijfdznljimrfyct.supabase.co https://vercel.live wss://ws-us3.pusher.com; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:; frame-src https://vercel.live`

The exact expected Permissions Policy, Referrer Policy, X-Content-Type-Options and X-Frame-Options were also present on live responses.

## Live route smoke

All checks below used the exact GREEN deployment, not a stale branch alias:

| Route | Result | Observed boundary |
| --- | --- | --- |
| `/` | HTTP 200 | CSP + all approved security headers present |
| `/parts/dq500-valve-body-assembly` | HTTP 200 | Full product SSR content rendered; CSP + all approved headers present |
| `/api/mobile/v1/marketplace` | HTTP 200 | JSON marketplace payload returned; CSP + all approved headers present |
| `/account` | HTTP 200 | Signed-out account/auth screen rendered; CSP + all approved headers present |
| `/manifest.webmanifest` | HTTP 200 | Valid manifest JSON returned; CSP + all approved headers present |
| `/sw.js` | HTTP 200 | Service-worker JavaScript returned; CSP + all approved headers present |

Vercel runtime observations for the exact deployment after the smoke requests:

- `error` / `fatal` over the checked one-hour window: **0 matching logs**
- HTTP `5xx` grouped count over the checked one-hour window: **0 matching responses**

## Important evidence boundary

The available Vercel fetch tool verifies delivered HTTP responses and server-rendered output, but it does not execute JavaScript as a real interactive browser. Therefore this evidence does **not** claim a browser-console CSP-violation sweep across every interactive path.

The code/test/build/runtime evidence proves the central header contract, live delivery, route/server rendering, public API response, manifest/service-worker availability and absence of observed server-side 5xx/errors in the checked window. Interactive browser CSP-console observation remains a separate manual/browser-execution layer if required.

Nonce/hash-based CSP is also intentionally deferred. `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` are an explicit RC compatibility trade-off for Next.js inline hydration/streaming and current styling. Moving to nonce/hash CSP would be a separate architectural hardening task and must not be inferred as already implemented.

## Classification

**VERIFIED for the scoped RC boundary:** globally delivered enforced CSP and agreed HTTP security headers, environment-specific Preview/Production policy separation, full CI/build/concurrency/scale regressions, exact Preview HTTP smoke and clean checked runtime window.

**Not claimed:** nonce/hash CSP, interactive browser console proof for every application journey, or additional headers outside the approved Variant A scope.
