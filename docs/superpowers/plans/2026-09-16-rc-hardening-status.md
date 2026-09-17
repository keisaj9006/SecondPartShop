# SecondPart RC hardening — current status 2026-09-17

This file supersedes `2026-09-15-rc-hardening-status.md` for current execution status. The original `2026-09-12-rc-hardening.md` remains the historical plan and defect register. `VERIFIED` applies only to the observed boundary; external prerequisites are not waived by green CI.

## Clean application boundary

Latest fully verified application-code boundary:

- SHA `62fba262a4351d30503441ec73d57cc90211564d`
- GitHub Actions `35209338887`: **SUCCESS**
- full validation pipeline: lint, typecheck, full tests, release validators, production build, true last-stock concurrency and isolated 100k marketplace PostgreSQL proof all PASS
- exact Vercel Preview `dpl_BtCP66VCyaU6Hg5dB15wCiZdxbAY`
- exact Preview URL `https://second-part-shop-ooy1rbil9-joannakwapis11-5369.vercel.app`
- deployment state: READY
- `main` untouched
- no Production configuration or data modified in this execution session

Current branch head after evidence-only work is documentation-only and may be ahead of the clean code boundary.

## Newly closed / hardened

### Find My Part seller-response comparison — VERIFIED engineering + exact Preview boundary

Buyer request responses now support direct decision comparison without adding a second quote subsystem or changing the request-to-listing model. Sellers still respond by publishing normal active listings linked through `source_request_id`.

For each active linked response, `/requests` now shows:

- part price;
- delivery price;
- delivered total;
- condition;
- dispatch time;
- warranty;
- seller verification;
- `View part`.

A single response remains labelled `Seller response`; two or more are labelled `Compare seller responses`. The projection remains bounded to public listing/seller fields and does not add seller postcode, owner ID, email, phone, description, latitude/longitude or buyer registration to the response object. The loader still limits responses to six and only includes `active` listings.

TDD evidence:

- RED `22bbbf3d3aa298f05fb02652074f38ced70156b2`, GitHub Actions `35209102315`, with the new comparison contract failing before implementation;
- final GREEN SHA `62fba262a4351d30503441ec73d57cc90211564d`;
- GitHub Actions `35209338887`: all three jobs PASS;
- exact Preview `dpl_BtCP66VCyaU6Hg5dB15wCiZdxbAY`: READY.

Evidence: `docs/test-runs/2026-09-17-find-my-part-response-comparison.md`.

A fresh authenticated multi-response buyer fixture was not fabricated solely for visual evidence, so this is not labelled a new hosted authenticated multi-response E2E.

### Critical alert destination receipt — VERIFIED

Preview-only Discord operations alerts are configured with a dedicated `#secondpart-alerts` destination. The final smoke on application SHA `fd9c94b7b7e6ed858b4cdc5588771035c9f257fd` returned `delivered · HTTP 204`, the message was visibly present in Discord, and exact-deployment Vercel logs recorded the smoke event without `SECOND_PART_ALERT_DELIVERY_FAILED`.

A real false-negative was found during this work: Discord accepted the message but the original 1500 ms sender timeout aborted while waiting for the response. TDD RED `c58f41faf07d942332fe5ecc4ac1d286420fa388`; GREEN `fd9c94b7b7e6ed858b4cdc5588771035c9f257fd`; CI `35069547432` SUCCESS. The timeout is now 5000 ms. The temporary QA admin elevation used to access the protected smoke page was reverted and read back as `seller`.

Evidence: `docs/test-runs/2026-09-15-alert-destination-preflight.md`.

### Preview Auth email origin — VERIFIED code/Preview boundary

Signup, resend-confirmation and password-reset email redirect origins use the trusted Preview origin resolver rather than localhost. Fresh confirmation-email evidence showed a Preview callback URL.

### Server-side token-hash Auth confirmation — application support VERIFIED

A fresh disposable QA signup successfully received a real confirmation email, but opening the old PKCE-style confirmation path did not establish a confirmed Auth user. `email_confirmed_at` remained null, so the destructive deletion E2E was not falsely promoted to PASS and the Auth record was not manually altered.

The application was then hardened to the Supabase SSR token-hash pattern:

- signup and resend target `/auth/confirm?next=...`;
- password recovery targets `/auth/confirm?next=/auth/reset-password`;
- `/auth/confirm` verifies `token_hash` with server-side `verifyOtp`;
- safe internal return paths are preserved and unsafe external redirects fall back safely;
- existing signup/recovery failure UX is preserved.

TDD evidence:

- RED `2cb98fb17c790e1d70142843dcd15380a7084f7a`, GitHub Actions `35109228030` failed on the new contract as expected;
- implementation `c2877575722b22a4d016db8a9b5ab8b57dd87a17` + `1b2a8a26881d4f7e10ef405bdd972a0617aa13cd`;
- aligned regression tests `52533a6bd82ef39f1ac9a98ec61b955e1174d276`;
- GREEN GitHub Actions `35109664613`: all three jobs PASS;
- exact Preview `dpl_9yp955BsxLxC9NshYravvoAE3ZH3`: READY.

The Preview route was live-smoked without a token and reached the expected safe `confirmation-failed` Account UX.

**Remaining boundary:** Supabase project-level Auth email templates still need a controlled change to emit `TokenHash` into this route. That project-wide configuration was deliberately not changed in a Preview-only session. Therefore application support is VERIFIED, but a new real token-hash email-confirmation lifecycle remains unsigned.

### `seller_checkout_ready` least-privilege grant — code/migration VERIFIED, hosted deployment pending

The current connected Supabase database exposes seventeen public `SECURITY DEFINER` functions to `anon`. Sixteen are buyer-facing read-model/search/profile functions. `public.seller_checkout_ready(uuid)` is different: it is an internal commerce/publication helper and does not need to be a direct anonymous API surface.

Hosted pre-change readback confirmed EXECUTE for `anon`, `authenticated` and `service_role`.

A least-privilege migration now revokes direct execution from `PUBLIC`/`anon` while preserving `authenticated` and `service_role`:

- RED contract `f21cb855460a05efe7f7652f575ebd384bc5f41c`, GitHub Actions `35110422165` failed at the deliberately missing migration contract;
- migration `supabase/migrations/20260916144500_restrict_seller_checkout_ready_anon.sql`;
- GREEN `757275da2222b69da819aca7b1207b9644c47108`, GitHub Actions `35110601856`: all jobs PASS;
- exact Preview `dpl_7ihCaS3s7J1QK4nDVDoz1TWnFQtn`: READY.

The migration was **not** applied to the connected Supabase project from this session because repository environment documentation treats that database as Production-candidate state while this execution scope is Preview-only. Hosted `anon` EXECUTE therefore remains unchanged until a controlled DB deployment is explicitly authorised.

Evidence: `docs/test-runs/2026-09-16-auth-confirmation-and-rpc-grant-hardening.md`.

## Current gap register

| Area | Current classification | Exact boundary / prerequisite |
| --- | --- | --- |
| Returns / refunds / reversals | **VERIFIED real provider E2E** | Genuine Preview UI → Stripe sandbox → Supabase full refund plus released-payout reversal. Provider retry stayed idempotent. Other refund variants remain separate boundaries. |
| Decline / abandon / retry / expiry | **P0 provider/UI UNSIGNED** | Requires a truthful active checkout-ready listing. QA seller is payout-ready, but its dedicated draft has no donor/fitment/OEM/manufacturer+part-number evidence. Existing image contains no clearly legible part/OEM number. Do not invent compatibility or SQL-publish around the product guard. |
| Last-stock concurrency | **VERIFIED DB concurrency; P0 provider/UI UNSIGNED** | Exact two-connection stock-1 race is proven and remains green. Full Preview/Stripe/UI race needs the same truthful active checkout-ready fixture. |
| Refund/reversal idempotency | **VERIFIED provider-level** | One refund and one reversal remained one each through real retry. |
| Delayed/out-of-order events | **VERIFIED code + deployed SQL + hosted PG17** | Hosted rollback probes cover key adverse ordering. Deliberate Stripe-side replay of every ordering remains a separate provider boundary. |
| Received / Accept / 48 h | **VERIFIED state semantics + explicit-Accept provider path; natural elapsed observation pending** | No currently pending received item exists. Never alter historic timestamps to manufacture evidence. |
| Roles / authorization | **VERIFIED current app + hosted DB boundary** | Admin pages/actions and RPC boundaries have negative-path evidence. Temporary alert-test admin elevation was reverted to seller. |
| Auth password hardening | **VERIFIED app/config scoped; leaked-password check PLAN-LIMITED** | Minimum password/current-password safeguards are in place. Supabase security advisor still reports leaked-password protection disabled; repository evidence classifies provider leaked-password protection as plan-limited and no project Auth setting was changed in this session. |
| Auth Preview email origin | **VERIFIED code + fresh email redirect boundary** | Preview confirmation email uses a Preview origin rather than localhost. |
| Auth token-hash confirmation | **VERIFIED application support; project template config OPEN** | Server-side `/auth/confirm` + `verifyOtp` is green and deployed. Supabase confirmation/recovery templates still need controlled TokenHash wiring before a new email lifecycle can be signed off. |
| RLS / Storage / private data | **VERIFIED scoped hosted + public serialization; one DB grant hardening staged** | Private seller/draft/evidence boundaries and public allowlists remain verified. `seller_checkout_ready` anon revoke is source-controlled and green but intentionally not applied to the connected Supabase database yet. |
| Messaging / notifications | **VERIFIED in-app + authorization; physical FCM/email receipt EXTERNAL** | Physical FCM remains a device gate. |
| Support journey | **VERIFIED in-app + hosted authorization; monitored public mailbox EXTERNAL** | Public operational support mailbox/ownership remains launch configuration. |
| Scale | **VERIFIED isolated 100k PostgreSQL engineering proof** | Latest application boundary also keeps the 100k proof green. Does not claim hosted concurrent latency or image-CDN load. |
| SEO / production origin | **Preview VERIFIED; Production domain EXTERNAL** | Production canonical/sitemap waits for approved real domain. |
| HTTP security headers / CSP | **VERIFIED scoped RC boundary** | Global CSP and response headers remain live on Preview; later code boundaries passed the full release pipeline. |
| Monitoring / diagnosis | **VERIFIED engineering + real Preview alert receipt** | Discord receipt gate is closed for Preview. Production alert destination remains launch-environment configuration. |
| Privacy / deletion / retention | **VERIFIED deployed preflight; destructive E2E OPEN / legal EXTERNAL** | Full Auth+DB+Storage destruction still needs a fresh disposable legitimately confirmed account. Token-hash app support is ready, but Supabase Auth templates still need controlled configuration before retry. |
| Web / Android | **Web + anonymous Preview scoped VERIFIED; physical Android EXTERNAL** | Signed device app-links, FCM receipt, upload and external-return matrix require physical device execution. |
| Accessibility | **Engineering VERIFIED; native SR/zoom EXTERNAL** | Automated/keyboard coverage is not relabelled as TalkBack/native zoom evidence. |
| Bulk seller CSV | **VERIFIED hosted partial import + retry/uniqueness** | Existing evidence retained. |
| Find My Part / responses | **VERIFIED hosted ownership/match + response-comparison engineering/Preview boundary; broader network/P2 remains** | Buyer can compare linked active responses by delivered total, condition, dispatch, warranty and seller verification. A fresh hosted authenticated multi-response fixture was not manufactured. DVSA remains external; manual vehicle fallback remains valid. |
| Liquidity / seller supply | **EXTERNAL operational gate** | Real seller inventory/network cannot be manufactured by test data. |

## Checkout fixture preflight — current hosted facts

`SecondPart QA Seller` remains a legitimate seller entity owned by the confirmed seller profile used for QA. Its Stripe test-mode payment account reports `onboarding_status=complete`, transfers/payouts/details submitted true.

Its draft `QA CHECKOUT TEST PART - NOT FOR REAL SALE` has stock 1 but no donor vehicle, catalogue fitment, OEM number or complete manufacturer + part-number pair. The existing image was previously inspected and contains no clearly legible number. Therefore it remains a draft.

Active seeded stock exists elsewhere, but those sellers are not currently valid payout-ready candidates for a fresh normal provider checkout. No direct SQL activation, fabricated compatibility, invented OEM/part number or fake ownership is permitted.

Evidence: `docs/test-runs/2026-09-15-checkout-fixture-preflight.md` plus hosted read-only recheck on 2026-09-16.

## Destructive deletion attempt — current blocker

A fresh disposable-account route was attempted without touching existing QA users. The account received a real confirmation email, but the old PKCE callback did not establish confirmation. Readback showed `email_confirmed_at` still null. We did not weaken Confirm Email, create a bootstrap/backdoor route, mutate an existing password, manually set confirmation state or delete an existing QA account.

The application now supports the safer server-side token-hash confirmation route, but a project-level Supabase Auth email-template change is still required before retrying the destructive lifecycle through that path.

Evidence: `docs/test-runs/2026-09-16-account-deletion-e2e-attempt.md` and `docs/test-runs/2026-09-16-auth-confirmation-and-rpc-grant-hardening.md`.

## Remaining closed-beta P0 / external checklist

1. **Stripe adverse checkout provider/UI** — requires a truthful active checkout-ready disposable listing/session.
2. **Full provider/UI last-stock race** — same checkout-fixture prerequisite.
3. **Natural 48 h auto-release provider observation** — requires a fresh legitimate received order and elapsed window if retained as beta sign-off evidence.
4. **Physical Android signed-device matrix** — app links, FCM receipt, image upload and external-return flows.
5. **Destructive account deletion E2E** — configure/verify the normal token-hash Supabase Auth email-template path, then use a fresh disposable confirmed account only.
6. **Auth leaked-password protection** — provider/project plan/configuration gate; current advisor still reports it disabled.
7. **Controlled DB deployment of `20260916144500_restrict_seller_checkout_ready_anon.sql`** — in an explicitly authorised Supabase environment, then verify `anon` denied while `authenticated` and `service_role` retain EXECUTE.
8. **Legal/support operations** — contracting identity, retention/privacy wording sign-off and monitored support mailbox.
9. **Marketplace liquidity / real seller supply** — operational business gate.

### No longer open on Preview

- **Critical alert destination receipt** is closed for the observed Preview boundary: real Discord receipt + provider HTTP 204 is recorded.
- **Find My Part response comparison** is green on the exact Preview application SHA and no longer an engineering gap; broader real network/liquidity remains separate.

Closed beta is therefore **not globally READY**, but the remaining gap set is now concentrated in genuine provider/UI sessions, physical-device evidence, project-level Auth/DB configuration, legal/operational setup and real marketplace supply. Green CI or isolated database proofs must not be used to waive those boundaries.
