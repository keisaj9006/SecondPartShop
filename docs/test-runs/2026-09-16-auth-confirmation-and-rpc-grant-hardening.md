# SecondPart auth confirmation + RPC grant hardening — 2026-09-16

## Scope

This note records two release-hardening changes completed on `rebuild-nextjs` without modifying Production configuration or applying a new migration to the connected Supabase project.

## 1. Email confirmation diagnosis and application hardening

A fresh disposable QA signup was created through the normal Preview registration path. The user opened the real confirmation email, but the account remained unconfirmed in Supabase and the redirect ended at the existing `confirmation-failed` UX.

The observed failure was consistent with the current server-side PKCE callback path requiring browser verifier context that is not guaranteed when a confirmation email is opened from a different browsing context.

The application was hardened to support the Supabase SSR token-hash confirmation pattern:

- sign-up confirmation emails now target `/auth/confirm?next=...`;
- resend confirmation uses the same endpoint;
- password recovery targets `/auth/confirm?next=/auth/reset-password`;
- `/auth/confirm` verifies `token_hash` with `verifyOtp` server-side;
- safe internal return paths are preserved;
- unsafe/external return destinations fall back to `/account`;
- expired recovery links return to the existing forgot-password UX;
- failed signup confirmation preserves the existing `confirmation-failed` UX and safe retry context.

TDD evidence:

- RED contract commit: `2cb98fb17c790e1d70142843dcd15380a7084f7a`
- RED GitHub Actions: `35109228030` — expected failure at the new auth confirmation contract
- implementation commits: `c2877575722b22a4d016db8a9b5ab8b57dd87a17`, `1b2a8a26881d4f7e10ef405bdd972a0617aa13cd`
- aligned regression tests: `52533a6bd82ef39f1ac9a98ec61b955e1174d276`
- GREEN GitHub Actions: `35109664613` — all three jobs passed, including lint, typecheck, full tests, release validators, build, true last-stock concurrency and isolated 100k PostgreSQL scale proof
- exact Vercel deployment: `dpl_9yp955BsxLxC9NshYravvoAE3ZH3` — READY on SHA `52533a6bd82ef39f1ac9a98ec61b955e1174d276`

A live Preview smoke of `/auth/confirm` without a token reached the expected safe `confirmation-failed` Account UX, proving the route is deployed and wired.

### Remaining configuration boundary

The application change alone does not rewrite Supabase Auth email templates. The project-level confirmation/recovery templates still need a controlled configuration change to emit `TokenHash` into `/auth/confirm` before a new destructive account-deletion E2E can use this path end-to-end.

That Auth-template setting was deliberately **not** changed from this session because it is project-wide and the connected Supabase project is treated as a Production-candidate boundary in repository documentation. No Production configuration was modified.

Therefore:

- application-side token-hash confirmation support: **VERIFIED**;
- real new email confirmation through the token-hash template: **EXTERNAL CONFIG / NOT YET VERIFIED**;
- destructive account-deletion E2E: **still OPEN**.

## 2. Anonymous execution of `seller_checkout_ready`

The current Supabase security advisor surface was re-inspected. Seventeen public `SECURITY DEFINER` functions were executable by `anon` on the connected database.

Sixteen are buyer-facing public read-model/search/profile functions. `public.seller_checkout_ready(uuid)` is different: it is an internal commerce/publication helper used to determine whether a seller has completed payout setup. It does not need to be a direct anonymous API surface.

Hosted readback confirmed before the change:

- `anon`: EXECUTE = true
- `authenticated`: EXECUTE = true
- `service_role`: EXECUTE = true

A least-privilege migration was added on `rebuild-nextjs` to revoke direct execution from `PUBLIC`/`anon` while preserving `authenticated` and `service_role`.

TDD evidence:

- RED contract commit: `f21cb855460a05efe7f7652f575ebd384bc5f41c`
- RED GitHub Actions: `35110422165` — `npm test` failed on the deliberately missing grant-hardening migration; independent scale and last-stock jobs stayed green
- migration commit: `757275da2222b69da819aca7b1207b9644c47108`
- migration: `supabase/migrations/20260916144500_restrict_seller_checkout_ready_anon.sql`
- GREEN GitHub Actions: `35110601856` — all jobs passed, including full test suite, every release validator, production build, true two-connection last-stock race and isolated 100k PostgreSQL scale proof
- exact Vercel deployment: `dpl_7ihCaS3s7J1QK4nDVDoz1TWnFQtn` — READY on SHA `757275da2222b69da819aca7b1207b9644c47108`

### Hosted database boundary

The migration has **not** been applied to the connected Supabase project from this session. Repository environment documentation treats that project as part of Production-candidate state, while this hardening session authorises only `rebuild-nextjs` and Preview. Applying the DDL there would exceed the current environment boundary.

Therefore the hosted database still reports anonymous EXECUTE for this helper until a controlled database deployment is explicitly authorised.

## Result

- No Production configuration or data was modified.
- `main` was not touched.
- Application-side Auth confirmation hardening is green and deployed to Preview.
- The least-privilege RPC migration is green and ready on `rebuild-nextjs`, but intentionally not deployed to the connected Supabase project.
- These changes do not waive the remaining provider/UI, physical-device, Auth-template, leaked-password, legal or operational release gates.
