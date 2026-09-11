# SecondPart 1.0 — Completion Checklist

This is a high-level gate. Use `docs/launch-readiness.md` for canonical detail.

## A. Code baseline

- [ ] `git diff --check`
- [ ] lint passes
- [ ] typecheck passes
- [ ] production build passes
- [ ] relevant validation scripts pass
- [ ] no secret leakage
- [ ] no unintended `main` changes
- [ ] migrations are consistent

## B. Core marketplace

- [ ] public browse stable
- [ ] search stable
- [ ] product detail stable
- [ ] saved vehicle / Garage stable
- [ ] add/select new vehicle works cleanly
- [ ] compatibility filter understandable
- [ ] compatibility fallback states honest
- [ ] OE/OEM search stable
- [ ] seller profile/listing lifecycle stable
- [ ] large inventory path does not require impractical manual work
- [ ] Find My Part/request flow usable

## C. Fitment / trust

- [ ] confirmed vs family/unknown fit not conflated
- [ ] "why it fits" or equivalent evidence can be surfaced where appropriate
- [ ] seller verification protected
- [ ] reviews are transaction-backed
- [ ] Verified Fit is transaction-backed
- [ ] wrong-part workflow exists and is tested
- [ ] sensitive categories do not make overconfident compatibility claims

## D. Commerce

- [ ] seller Stripe test onboarding proven
- [ ] buyer checkout proven
- [ ] webhook payment confirmation proven
- [ ] stock reservation proven
- [ ] competing checkout race proven
- [ ] declined -> retry -> success proven
- [ ] cancellation proven
- [ ] refund proven
- [ ] return/case proven
- [ ] payment dispute proven
- [ ] payout eligibility proven
- [ ] payout transfer/reversal/recovery proven
- [ ] silent-buyer policy proven
- [ ] transaction audit/event state verified

## E. Account / security / operations

- [ ] account deletion destructive E2E proven
- [ ] leaked-password protection enabled
- [ ] monitoring configured
- [ ] critical alerts configured
- [ ] support email configured
- [ ] privacy-safe logging verified
- [ ] RLS/advisor checks acceptable

## F. Android / Google Play

- [ ] stable production HTTPS origin
- [ ] package final
- [ ] upload key configured
- [ ] Play App Signing configured
- [ ] App Links fingerprint set correct
- [ ] Firebase production config
- [ ] production AAB generated
- [ ] evidence pack stored
- [ ] internal/closed test installed through Play
- [ ] physical RC matrix completed
- [ ] FCM physical E2E completed
- [ ] store assets complete
- [ ] Data Safety / App Content declarations complete
- [ ] privacy/account deletion URLs verified

## G. Legal / marketplace policy

- [ ] final Terms review
- [ ] final Privacy review
- [ ] consumer-rights wording checked
- [ ] seller obligations checked
- [ ] returns/refunds checked
- [ ] fees/payout wording checked
- [ ] public support/contact checked

## H. Liquidity

Target gate before broad public paid acquisition:

- [ ] ~30 large active sellers
- [ ] 15–20 breakers/ATFs in active base
- [ ] >=25,000 live listings
- [ ] acceptable search fill rate in chosen launch categories
- [ ] Find My Part produces real seller responses
- [ ] real beta transactions completed
- [ ] wrong-fit rate measured
- [ ] seller cancellation/dispatch performance measured
- [ ] reviews come only from genuine transactions

## I. Final launch question

Do not ask only:

> "Does the app work?"

Ask:

> "Can a real UK buyer find the correct part, buy it safely, receive it, resolve a problem if necessary, and can a real seller fulfil and get paid without us manually faking provider or inventory state?"

If the answer is not proven end-to-end, 1.0 is not ready.
