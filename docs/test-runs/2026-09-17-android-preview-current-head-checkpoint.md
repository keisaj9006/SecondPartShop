# Android Preview + current HEAD checkpoint — 2026-09-17

Branch: `rebuild-nextjs`

This checkpoint records the verified boundary after the Android Preview origin/validator repair. It is evidence for the Preview/RC hardening plan only. It does not convert any physical-device, Production, Google Play, FCM or provider-external gate into a pass.

## Current branch verification

Verified code HEAD before this evidence-only commit:

- Commit: `0c849e2a23a80b1909d168c0c877884f5945d107`
- Message: `fix: align mobile preview validator origin`
- GitHub Actions run: `35215533760` (`rebuild-nextjs QA`)
- Result: **PASS**
- `validate`: PASS
- `marketplace-scale-postgres`: PASS
- `last-stock-concurrency`: PASS

The `validate` job completed the normal branch gate including install/diff checks, lint, TypeScript, the test suite, release validators and the production Next.js build. The scale job retained the isolated 100k-search proof and the concurrency job retained the genuine two-connection PostgreSQL stock-1 race proof.

## Current Vercel Preview verification

Current deployment for `0c849e2a23a80b1909d168c0c877884f5945d107`:

- Deployment: `dpl_286wQCAtkkcCcifyTQg2BV8Zxpec`
- Exact URL: `https://second-part-shop-3msj1gxh0-joannakwapis11-5369.vercel.app`
- Stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`
- State: **READY**

Read-only hosted checks against the exact deployment on 2026-09-17:

- `/api/mobile/v1/health` -> HTTP 200 with `ok=true`, `service=secondpart-mobile-api`, `apiVersion=v1`, `backendReady=true`.
- `/` -> HTTP 200 and the full current Next.js marketplace frontend rendered.
- The hosted Home response contains the current vehicle identification flow, the `Show only parts that fit this vehicle` control, marketplace search/filter UI and the current mobile root navigation.
- Preview remains `noindex`; the observed API response retained the expected no-store/security headers.

This is hosted Preview evidence only. It is not physical Android evidence.

## Android Preview APK pipeline

Latest successful Android Preview APK build that contains the same runtime/application code boundary:

- Source commit: `b0ff850904abc073d0e2b9a50ba1e1dcb5aad048`
- Message: `fix: generate Android Preview from rebuild branch alias`
- Workflow run: `35214653966` (`Android Preview APK`)
- Job: `Build SecondPart Android Preview`
- Result: **PASS**

Observed successful pipeline steps include:

- full Next.js frontend preparation for Android Preview;
- native JavaScript bridge build;
- stable Preview signing-key restore;
- Android project generation;
- deep-link patching;
- Capacitor sync;
- explicit verification that Preview uses the full frontend;
- Preview Firebase service configuration;
- debug APK build;
- APK signer verification;
- artifact preparation and upload.

Artifact:

- Name: `SecondPart-Android-Preview-Manual`
- Artifact id: `10493049326`
- Size: `8,446,085` bytes
- SHA-256 digest: `99c819b6a6ee5297fbc1650ac7f893aff7b847371d7c48ee78a2d893f7e352cf`
- GitHub retention expiry: `2026-10-01`

The APK was built from `b0ff850...`, not from `0c849e2...`. Comparing `b0ff850...` to `0c849e2...` shows only test/validator changes in:

- `scripts/test-android-preview-origin.mjs`
- `scripts/validate-mobile-performance.mjs`

No application, Android wrapper, Capacitor configuration or runtime frontend file changed in that interval. Therefore this artifact is valid evidence for the runtime produced immediately before the validator-only repair, while the current HEAD has the fresh green branch QA that verifies the corrected invariant.

## Root cause closed by the current HEAD

The Android Preview generator/workflow had already moved to the stable `rebuild-nextjs` Preview alias, while the mobile-performance validator still asserted the older convenience Preview origin. The app/runtime configuration and QA invariant therefore disagreed. `0c849e2...` aligns the validator with the intended stable branch Preview origin; the full `rebuild-nextjs QA` then passed.

## Explicit limits / still open

This checkpoint does **not** mark the following as complete:

- physical Android RC matrix;
- physical FCM delivery;
- Google Play test-track install/update;
- Production AAB/domain/app-link/Firebase configuration;
- physical camera/image upload, hardware Back, network-loss/recovery or deep-link behaviour;
- any provider scenario not separately evidenced by the commerce runbooks/status file;
- destructive account-deletion E2E;
- external Supabase Auth configuration gates;
- legal/support identity, Production mailbox or marketplace-liquidity gates.

`main` and Production were not modified by this checkpoint.
