# SecondPart RC hardening — current status 2026-09-18

This file supersedes `2026-09-15-rc-hardening-status.md` for current execution status. The original `2026-09-12-rc-hardening.md` remains the historical plan and defect register. `VERIFIED` applies only to the observed boundary; external prerequisites are not waived by green CI.

## Clean application boundary

Latest fully verified application-code boundary:

- SHA `78bb46883f553c0cbc2efc95895e25a51881cd37`
- GitHub Actions `35354417869`: **SUCCESS** across `validate`, `marketplace-scale-postgres` and `last-stock-concurrency`
- full validation pipeline: lint, typecheck, **600/600 tests**, commerce/release validators, production build, true two-connection last-stock concurrency and isolated 100k marketplace PostgreSQL proof all PASS
- exact Vercel Preview `dpl_A15GTydkUuz3KkKgN9FM4RUaaBBN`
- exact Preview URL `https://second-part-shop-mfco8y5w0-joannakwapis11-5369.vercel.app`
- stable branch Preview alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`
- deployment state: READY
- fresh read-only health smoke on both exact deployment and branch alias: `/api/mobile/v1/health` HTTP 200 with `backendReady:true`
- `main` untouched
- no Production application deployment, live Stripe operation or hosted marketplace data mutation was performed by this mobile buyer-order hardening

Current branch HEAD may be documentation-only and ahead of the verified application boundary above.

## Newly closed / hardened

### Android Preview build pipeline — VERIFIED build/artifact boundary; physical-device gate remains EXTERNAL

The current Android Preview workflow successfully produced a signed debug Preview artifact against the stable `rebuild-nextjs` Preview origin.

- artifact source SHA: `b0ff850904abc073d0e2b9a50ba1e1dcb5aad048`;
- GitHub Actions run: `35214653966` — SUCCESS;
- artifact: `SecondPart-Android-Preview-Manual`, id `10493049326`;
- artifact digest: `sha256:99c819b6a6ee5297fbc1650ac7f893aff7b847371d7c48ee78a2d893f7e352cf`;
- workflow verified the generated Capacitor wrapper targets the stable branch Preview alias and completed Java/Android toolchain setup, deep-link patching, Capacitor sync, Firebase Preview config, `assembleDebug`, signer verification and artifact upload;
- the only application-boundary changes from `b0ff850...` to the current verified SHA `0c849e...` are validator/test alignment changes, not Android runtime/app-wrapper behavior.

Evidence: `docs/test-runs/2026-09-17-android-preview-current-head-checkpoint.md`.

This does **not** replace the physical signed-device matrix. App Links, FCM receipt, image upload and external-return behavior still require a real Android device/test-track observation before release sign-off.


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

### `seller_checkout_ready` least-privilege grant — VERIFIED source + hosted deployment

The connected Supabase database previously exposed seventeen public `SECURITY DEFINER` functions to `anon`. Sixteen are buyer-facing read-model/search/profile functions. `public.seller_checkout_ready(uuid)` is an internal commerce/publication helper and does not need direct anonymous execution.

Hosted pre-change readback confirmed EXECUTE for `anon`, `authenticated` and `service_role`.

The reviewed least-privilege migration revokes direct execution from `PUBLIC`/`anon` while preserving `authenticated` and `service_role`:

- RED contract `f21cb855460a05efe7f7652f575ebd384bc5f41c`, GitHub Actions `35110422165`;
- source migration `supabase/migrations/20260916144500_restrict_seller_checkout_ready_anon.sql`;
- source GREEN `757275da2222b69da819aca7b1207b9644c47108`, GitHub Actions `35110601856`;
- explicit hosted deployment authorised and applied on 2026-09-18 as migration `20260918122032 / restrict_seller_checkout_ready_anon`;
- post-deploy privilege readback: `anon=false`, `authenticated=true`, `service_role=true`;
- Security Advisor anonymous SECURITY DEFINER warning count fell from 17 to 16; `seller_checkout_ready` is no longer in the `anon` warning set.

No user, listing, order, Auth, payment or payout record was mutated by this grant-only deployment.

Evidence: `docs/test-runs/2026-09-16-auth-confirmation-and-rpc-grant-hardening.md` plus the 2026-09-18 hosted privilege readback.

### Mobile seller payment refresh synchronization — VERIFIED

The mobile seller payment refresh route had retained a private copy of Stripe/database synchronization logic after the canonical `syncSellerPaymentAccount` path was hardened. This allowed mobile refresh state to drift from web/checkout behavior.

TDD evidence:

- RED `d131f07105bb5adc42287f10529f9824d9eb9cbc`, GitHub Actions `35344973320`: 573 PASS / 3 expected FAIL;
- implementation `3c43d6f93cb512ec7425cd6cbe0061533974de38`;
- GREEN GitHub Actions `35345127617`: **576/576 PASS**, all validators and production build PASS;
- exact Preview `dpl_Hrn5bfc5hhzSY8vsgJ57Pwft2upW`: READY.

The mobile route now delegates provider/database synchronization to the same shared synchronizer used by checkout/web flows, preserves `not_started`, maps restricted provider states truthfully, and no longer mutates `seller_payment_accounts` directly.

Evidence: `docs/test-runs/2026-09-18-mobile-seller-payment-refresh.md`.

### Web seller payment refresh synchronization — VERIFIED

The manual web seller payment refresh action retained another private copy of Stripe/database readiness synchronization after the canonical `syncSellerPaymentAccount` path was hardened. That duplicate path could collapse provider-restricted states to `pending` and independently rewrite readiness fields.

TDD / validator evidence:

- RED `a1f4f03e1fa427f4fe978ddc0160c377d3eedfa3`, GitHub Actions `35345771596`: two expected web-refresh failures;
- implementation `f51a3e7f15927fe01a7b217bc212737016c591ff`;
- the first GREEN pass exposed one stale commerce validator that required the removed direct field writes rather than the canonical synchronizer contract;
- validator alignment `c830cb6f85812c682a6dfc0cfb07393102b74104`;
- final GitHub Actions `35346135192`: **578/578 PASS**, all commerce/release validators and production build PASS;
- exact Preview `dpl_AjwpfCWpzAPL4BFBaQQx9mwsp9VH`: READY.

The manual web refresh now uses the same shared seller-payment synchronizer as checkout, automatic onboarding-return sync and mobile refresh, while preserving existing revalidation, redirect and operational-monitoring behavior.

Evidence: `docs/test-runs/2026-09-18-web-seller-payment-refresh.md`.

### Web Stripe onboarding return failure handling — VERIFIED

The automatic web seller-payment sync on Stripe return already used the canonical synchronizer, but failures were silently collapsed to `null` and the UI still claimed that SecondPart had re-checked the account.

TDD evidence:

- RED `05307bdd332563d15b7e1b8c1c4afdef6adcdd96`, GitHub Actions `35347039313`: 579 PASS / 2 expected FAIL;
- implementation `02ea63dab48496424a12034d0fb2c3c9b8106268`;
- final GitHub Actions `35347166356`: **581/581 PASS**, all release/commerce validators and production build PASS;
- exact Preview `dpl_Gs1XTV56sMEkdH34xpXqmDzHZU3G`: READY.

The failure path now reports `payout / seller_stripe_onboarding_return_sync_failed`, shows a truthful retry message and no longer claims a successful automatic re-check. Success and normal pending/restricted return behavior remain unchanged.

Evidence: `docs/test-runs/2026-09-18-web-seller-payment-return-sync.md`.

### Checkout compatibility outage fail-closed — VERIFIED

Web and mobile checkout previously converted a compatibility lookup failure to `null` and continued toward reservation and Stripe Checkout. Because `prepare_checkout_order_v2` validates vehicle identity but does not re-run the part compatibility confidence/acknowledgement gate, an availability failure could bypass the uncertain-fit warning.

TDD evidence:

- RED `a00702468dee353a350b87c7b09f1bb2ebc55ce3`, GitHub Actions `35350026877`: 581 PASS / 2 expected FAIL; web reached Stripe and mobile returned 201 after a forced compatibility backend failure;
- web implementation `1fa5050036c86ff87344a1d5c74e50210039ed61`;
- final mobile/application SHA `d4a6a168e6f87bfc347ac41a8fb6c585369bcd28`;
- final GitHub Actions `35350230043`: **583/583 PASS**, all commerce/release validators and production build PASS;
- exact Preview `dpl_Agq6XHgYHVk6KXPJ967GWjWsFXp3`: READY.

Selected-vehicle checkout now fails closed if compatibility cannot be verified, reports an operational checkout error, and stops before stock reservation or Stripe session creation. Existing `confirmed` / `buyer_verified` and acknowledged uncertain-fit behavior is unchanged.

Evidence: `docs/test-runs/2026-09-18-checkout-compatibility-fail-closed.md`.

### Transaction list/admin false-empty handling — VERIFIED

Several transaction-facing pages previously converted Supabase/data-loader failures into valid-looking empty states. That could show “No purchases”, “No sales”, “No transaction cases” or “No commerce cases” during a backend outage; buyer case eligibility could also treat an unavailable active-case lookup as no active case.

TDD evidence:

- RED `667bb09136b85740a68a252dfacea40b27eb12f6`, GitHub Actions `35350713062`: 583 PASS / 8 expected FAIL;
- application changes across buyer purchases, seller sales, buyer cases, seller cases and Admin Commerce;
- first implementation exposed an invalid new monitoring component name during typecheck; it was aligned to existing `commerce_maintenance` taxonomy rather than expanding the monitoring model;
- final SHA `bcef9f5a4044967842a77a3995ede8081ef0b473`;
- final GitHub Actions `35351147618`: **591/591 PASS**, all commerce/release validators and production build PASS;
- exact Preview `dpl_625nAoAWQRmnPSeyWiBSr1vdzpjX`: READY.

Real empty datasets still render the existing empty-state UI. Backend failures now propagate to the existing global retry error boundary; Admin Commerce also emits `commerce_maintenance / commerce_admin_data_load_failed`.

Evidence: `docs/test-runs/2026-09-18-transaction-screens-fail-closed.md`.

### Transaction detail false-404 / false-empty handling — VERIFIED

Buyer order detail, seller sale detail, order timelines and the Buyer Cases selected-purchase lookup previously collapsed some backend failures into `notFound()`, `null` or an empty timeline.

TDD evidence:

- RED `0735e56a9decc70449d0d64a33d92d55bc136470`, GitHub Actions `35351654976`: 591 PASS / 6 expected FAIL;
- final application SHA `7b2f6bff1a6a4d718810f15de9f91ec0cd5ddbb6`;
- final GitHub Actions `35351853027`: **597/597 PASS**, all commerce/release validators and production build PASS;
- exact Preview `dpl_8JAB2bmwNPjtCPpiYQ9uGGveqaTB`: READY.

Genuine absent/unauthorised order or sale rows still produce the existing 404. Supabase/data-loader failures now propagate to the global retry boundary instead of being misrepresented as missing business data, and timeline failures no longer appear as empty transaction history.

Evidence: `docs/test-runs/2026-09-18-transaction-detail-pages-fail-closed.md`.

### Mobile buyer order sold-item retention — VERIFIED

Web buyer order history already had a protected fallback for sold listings hidden by public `parts` RLS after a real Stripe test purchase exposed the issue. Mobile order list/detail had not inherited that boundary and could silently drop the purchased order item.

TDD evidence:

- RED `ffc348d8950e0b6b5cb5fb224c3805f1f6376ca3`, GitHub Actions `35354167211`: 598 PASS / 2 expected FAIL;
- list implementation `4f2cb7a0290e69d8cb8dbd202743e00851618663`;
- detail/final application SHA `78bb46883f553c0cbc2efc95895e25a51881cd37`;
- final GitHub Actions `35354417869`: **600/600 PASS**, all commerce/release validators and production build PASS;
- exact Preview `dpl_A15GTydkUuz3KkKgN9FM4RUaaBBN`: READY.

The buyer-scoped order query remains the authorization gate. Only missing `parts` identities from an already authorized order are recovered server-side, selecting only `id/title/slug`. Inaccessible orders perform no privileged lookup. A recovery error fails with HTTP 503 instead of hiding the purchased item.

Evidence: `docs/test-runs/2026-09-18-mobile-buyer-orders-sold-items.md`.

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
| Auth password hardening | **VERIFIED app/config scoped; leaked-password check PLAN-LIMITED** | Minimum password/current-password safeguards are in place. Fresh provider/account readback confirms the current Supabase organisation is on **Free** and leaked-password protection is a **Pro+** feature, so the remaining gate is an explicit plan upgrade/configuration decision rather than an application-code defect. |
| Auth Preview email origin | **VERIFIED code + fresh email redirect boundary** | Preview confirmation email uses a Preview origin rather than localhost. |
| Auth token-hash confirmation | **VERIFIED application support; project template config OPEN** | Server-side `/auth/confirm` + `verifyOtp` is green and deployed. Supabase confirmation/recovery templates still need controlled TokenHash wiring before a new email lifecycle can be signed off. |
| RLS / Storage / private data | **VERIFIED scoped hosted + public serialization + seller checkout grant** | Private seller/draft/evidence boundaries and public allowlists remain verified. `seller_checkout_ready` anonymous EXECUTE has been revoked in the connected project and read back as `anon=false`, `authenticated=true`, `service_role=true`. |
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
6. **Auth leaked-password protection** — current Supabase organisation is Free; leaked-password protection requires Pro+ and remains disabled until the explicit plan/configuration upgrade.
7. **Legal/support operations** — contracting identity, retention/privacy wording sign-off and monitored support mailbox.
8. **Marketplace liquidity / real seller supply** — operational business gate.

### No longer open on Preview

- **Critical alert destination receipt** is closed for the observed Preview boundary: real Discord receipt + provider HTTP 204 is recorded.
- **Find My Part response comparison** is green on the exact Preview application SHA and no longer an engineering gap; broader real network/liquidity remains separate.

Closed beta is therefore **not globally READY**, but the remaining gap set is now concentrated in genuine provider/UI sessions, physical-device evidence, project-level Auth/DB configuration, legal/operational setup and real marketplace supply. Green CI or isolated database proofs must not be used to waive those boundaries.
