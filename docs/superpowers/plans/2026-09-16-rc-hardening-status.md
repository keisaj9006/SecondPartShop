# SecondPart RC hardening — current status 2026-09-16

This file supersedes `2026-09-15-rc-hardening-status.md` for current execution status. The original `2026-09-12-rc-hardening.md` remains the historical plan and defect register. `VERIFIED` applies only to the observed boundary; external prerequisites are not waived by green CI.

## Clean application boundary

Latest fully verified application code boundary:

- SHA `4e712cdf8ed1197249fe45bd2b2c23e115fd05ae`
- GitHub Actions `35096527654`: **SUCCESS**
- full validation pipeline: lint, typecheck, tests, release validators, production build, true last-stock concurrency and isolated 100k marketplace PostgreSQL proof all PASS
- exact Vercel Preview `dpl_134etiRpLzeCyQQ2kGutnh1GANPR`
- exact Preview URL `https://second-part-shop-bgpv25473-joannakwapis11-5369.vercel.app`
- deployment state: READY

Current branch head after evidence-only work is documentation-only and may be ahead of the clean code boundary.

## Newly closed since 2026-09-15

### Critical alert destination receipt — VERIFIED

Preview-only Discord operations alerts are configured with a dedicated `#secondpart-alerts` destination. The final smoke on application SHA `fd9c94b7b7e6ed858b4cdc5588771035c9f257fd` returned `delivered · HTTP 204`, the message was visibly present in Discord, and exact-deployment Vercel logs recorded the smoke event without `SECOND_PART_ALERT_DELIVERY_FAILED`.

A real false-negative was found during this work: Discord accepted the message but the original 1500 ms sender timeout aborted while waiting for the response. TDD RED `c58f41faf07d942332fe5ecc4ac1d286420fa388`; GREEN `fd9c94b7b7e6ed858b4cdc5588771035c9f257fd`; CI `35069547432` SUCCESS. The timeout is now 5000 ms. The temporary QA admin elevation used to access the protected smoke page was reverted and read back as `seller`.

Evidence: `docs/test-runs/2026-09-15-alert-destination-preflight.md`.

### Preview Auth email origin — VERIFIED code/Preview boundary

Signup, resend-confirmation and password-reset email redirect origins now use the trusted Preview origin resolver rather than falling back to localhost. Current helper uses the configured origin outside Preview and, in Preview, the Vercel branch/deployment origin fallback chain. Fresh confirmation-email evidence showed a Preview callback URL rather than `http://localhost:3000`.

Final clean code SHA for this repair is `4e712cdf8ed1197249fe45bd2b2c23e115fd05ae`; CI `35096527654` SUCCESS; exact Preview `dpl_134etiRpLzeCyQQ2kGutnh1GANPR` READY. A full confirmed-user lifecycle was not claimed from that email test because provider email rate limits subsequently blocked a fresh disposable confirmation flow.

## Current gap register

| Area | Current classification | Exact boundary / prerequisite |
| --- | --- | --- |
| Returns / refunds / reversals | **VERIFIED real provider E2E** | Genuine Preview UI → Stripe sandbox → Supabase refund plus released-payout reversal. Provider retry stayed idempotent. |
| Decline / abandon / retry / expiry | **P0 provider/UI UNSIGNED** | Requires a truthful active checkout-ready listing. QA seller is checkout-ready, but its dedicated draft has no donor/fitment/OEM/manufacturer+part-number evidence. Existing image contains no clearly legible part/OEM number. Do not invent compatibility or SQL-publish around the product guard. |
| Last-stock concurrency | **VERIFIED DB concurrency; P0 provider/UI UNSIGNED** | Exact two-connection stock-1 race is proven. Full Preview/Stripe/UI race needs the same truthful active checkout-ready fixture as above. |
| Refund/reversal idempotency | **VERIFIED provider-level** | One refund and one reversal remained one each through real retry. |
| Delayed/out-of-order events | **VERIFIED code + deployed SQL + hosted PG17** | Hosted rollback probes cover key adverse ordering. Deliberate Stripe-side replay of every ordering remains a separate provider boundary. |
| Received / Accept / 48 h | **VERIFIED state semantics + explicit-Accept provider path; natural elapsed observation pending** | No currently pending received item exists. The only relevant historic items were explicitly accepted/released. Never alter historic timestamps to manufacture evidence. |
| Roles / authorization | **VERIFIED current app + hosted DB boundary** | Admin pages/actions and RPC boundaries have negative-path evidence. Temporary alert-test admin elevation was reverted to seller. |
| Auth password hardening | **VERIFIED app/config scoped; leaked-password check PLAN-LIMITED** | Minimum 8 chars and current-password requirement are configured. HaveIBeenPwned protection requires Supabase Pro. |
| Auth Preview email origin | **VERIFIED code + fresh email redirect boundary** | Preview confirmation email used the correct Preview callback. Provider email rate-limit currently prevents a fresh full confirmed-user E2E. |
| RLS / Storage / private data | **VERIFIED scoped hosted + public serialization** | Private seller/draft/evidence boundaries and public allowlists verified. |
| Messaging / notifications | **VERIFIED in-app + authorization; physical FCM/email receipt EXTERNAL** | No registered physical test device in current QA fixture. |
| Support journey | **VERIFIED in-app + hosted authorization; monitored public mailbox EXTERNAL** | Public operational support mailbox/ownership remains launch configuration. |
| Scale | **VERIFIED isolated 100k PostgreSQL engineering proof** | Does not claim hosted concurrent latency or image-CDN load. |
| SEO / production origin | **Preview VERIFIED; Production domain EXTERNAL** | Production canonical/sitemap waits for approved real domain. |
| HTTP security headers / CSP | **VERIFIED scoped RC boundary** | Global CSP and response headers live on Preview; browser-console nonce/hash hardening is separate. |
| Monitoring / diagnosis | **VERIFIED engineering + real Preview alert receipt** | Discord receipt gate is closed for Preview. Production alert destination remains launch-environment configuration. |
| Privacy / deletion / retention | **VERIFIED deployed preflight; destructive E2E BLOCKED / legal EXTERNAL** | Full Auth+DB+Storage destruction still needs a disposable confirmed authenticated account. Normal signup/resend is currently blocked by Supabase email rate limiting. An abandoned unconfirmed Auth fixture was deleted and verified absent from Auth, profiles and deletion requests. Do not delete existing QA accounts. |
| Web / Android | **Web + anonymous Preview scoped VERIFIED; physical Android EXTERNAL** | Signed device app-links, FCM receipt, upload and external-return matrix require physical device execution. |
| Accessibility | **Engineering VERIFIED; native SR/zoom EXTERNAL** | Automated/keyboard coverage is not relabelled as TalkBack/native zoom evidence. |
| Bulk seller CSV | **VERIFIED hosted partial import + retry/uniqueness** | Existing evidence retained. |
| Find My Part / responses | **VERIFIED hosted ownership/match boundary; broader network/P2 remains** | DVSA remains external; manual vehicle fallback remains valid. |
| Liquidity / seller supply | **EXTERNAL operational gate** | Real seller inventory/network cannot be manufactured by test data. |

## Checkout fixture preflight — current hosted facts

`SecondPart QA Seller` is Stripe checkout-ready (`onboarding_status=complete`, transfers/payouts/details submitted true). Its draft `QA CHECKOUT TEST PART - NOT FOR REAL SALE` has stock 1, one real image and manufacturer `renault`, but no donor vehicle, catalogue fitment, OEM number or part number. The image was inspected and contains no clearly legible number. Therefore it remains a draft.

Two active stock-1 seeded listings have compatibility evidence, but their seller `West Coast Auto Salvage` has no `owner_id` and no seller payment account. It cannot honestly pass normal Stripe Connect onboarding without manufacturing ownership. Those listings are not used for provider checkout evidence.

Evidence: `docs/test-runs/2026-09-15-checkout-fixture-preflight.md` plus hosted read-only recheck on 2026-09-16.

## Destructive deletion attempt — current blocker

A normal disposable-account route was attempted without touching existing QA users. Supabase confirmation/resend/new-signup paths hit provider email-rate-limit behavior before a fresh confirmed authenticated disposable session could be established. We did not weaken Confirm Email, create a bootstrap/backdoor route, mutate a real user password or delete an existing QA account.

An abandoned unconfirmed fixture was cleaned up by exact UUID with the `email_confirmed_at is null` guard; readback confirmed `auth_exists=false`, `profile_exists=false`, `deletion_request_exists=false`.

Evidence: `docs/test-runs/2026-09-16-account-deletion-e2e-attempt.md`.

## Remaining closed-beta P0 / external checklist

1. **Stripe adverse checkout provider/UI** — requires a truthful active checkout-ready disposable listing/session.
2. **Full provider/UI last-stock race** — same checkout-fixture prerequisite.
3. **Natural 48 h auto-release provider observation** — requires a fresh legitimate received order and elapsed window.
4. **Physical Android signed-device matrix** — app links, FCM receipt, image upload and external-return flows.
5. **Destructive account deletion E2E** — requires a disposable confirmed authenticated account once Auth email rate limiting clears or another normal supported Auth route is available.
6. **Auth leaked-password protection** — Supabase Pro plan required.
7. **Legal/support operations** — contracting identity, retention/privacy wording sign-off and monitored support mailbox.
8. **Marketplace liquidity / real seller supply** — operational business gate.

The Preview critical-alert receipt item is no longer on the remaining list.

Closed beta is therefore **not globally READY**, but all currently unblocked engineering P0/P1 work is either verified or reduced to an explicit external/provider prerequisite. Further engineering can proceed on public-launch/P2 product work without pretending that these provider/device/business gates are closed.
