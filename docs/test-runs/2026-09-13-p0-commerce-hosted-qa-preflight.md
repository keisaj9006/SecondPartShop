# P0 Commerce Hosted-QA Preflight — 2026-09-13

Branch: `rebuild-nextjs`

Purpose: record the current hosted-QA release-gate state without treating local/isolated PostgreSQL checks as a substitute for real Stripe/provider/device E2E evidence.

## Verified code / Preview baseline

- Support-conversation implementation commit `55166c60295aff79e5abea2f5b403aa08ea299e0` passed the full branch QA: 507/507 tests, lint with no errors, TypeScript, release validators, PostgreSQL last-stock race, isolated 25k marketplace scale proof, and production Next.js build.
- Exact Vercel deployment `dpl_FshZ5tf5Uh3Th4DqvEoLqAtu4T4t` is READY for that SHA.
- Branch alias `second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app` resolves to that deployment.
- Preview `/`, `/contact`, customer support-detail gating and admin support-detail gating returned the expected runtime behaviour.
- Preview remains fail-closed for indexing: `robots.txt` disallows `/`, sitemap is empty, and responses carry `noindex`.

## Hosted Supabase QA commerce preflight

Read-only aggregate checks against project `secondpart` showed:

- buyer profiles: 1
- seller profiles: 2
- active in-stock listings: 6
- payout-ready Stripe payment accounts: 1
- checkout-ready sellers: 1
- checkout-ready listings: **0**
- existing orders: 2

This means real Commerce Scenario G/H cannot be started yet through the normal product path because there is no active checkout-ready listing owned by the payout-ready seller.

### Payout-ready seller drafts

The payout-ready seller has two draft listings. Read-only validation against the same rules enforced by `updateListing` found:

1. Draft A: core fields valid, stock valid, category valid, transmission fields valid where applicable, seller checkout-ready, current Terms accepted, and **3 real product photos present**. The only publication blocker is **missing genuine compatibility evidence**.
2. Draft B: core fields valid and seller checkout-ready, but **no product photo** and **no genuine compatibility evidence**.

Compatibility evidence must come from a real donor vehicle, exact catalogue fitment, OE/OEM number, or manufacturer + part number. It must not be invented merely to make release QA pass.

## Scenario G — hosted concurrency status

- The repository already has a true two-connection PostgreSQL 17 race test for stock `1`; it passes in CI and proves the canonical `prepare_checkout_order` row-lock behaviour in an isolated database.
- That is **not** sufficient to mark the hosted/provider P0 gate complete.
- Hosted QA exposes the optional `dblink` extension, but a same-project secondary connection requires database credentials/GSSAPI credentials that the ChatGPT/Supabase connector deliberately does not expose.
- No attempt was made to read Vault secrets, weaken credential boundaries, or mutate existing QA listings to simulate readiness.

Therefore Scenario G remains open for a genuine hosted/app test with two independent buyer sessions once an eligible listing is published through the normal seller UI.

## Scenario H — declined payment then retry status

Code/CI guards are present for the rule that `payment_intent.payment_failed` alone must not release stock or cancel an open provider checkout, but the P0 gate still requires a real Stripe test-mode checkout with a declined attempt followed by a successful retry in the same Checkout flow.

Scenario H remains **OPEN** until provider evidence is collected.

## Supabase Auth security gate

Fresh Supabase Security Advisor readback reports:

- **Leaked Password Protection Disabled** (`auth_leaked_password_protection`).

This is an Auth project setting, not a database migration. The current connector exposes database/project operations but does not expose an Auth-config write action, so this setting was not changed indirectly or bypassed.

Reference remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Release conclusion

Do **not** mark Commerce Scenario G, Scenario H, or leaked-password protection complete from this checkpoint.

The shortest legitimate path to the next real provider test is:

1. Open the nearly-ready payout-seller draft through the normal Seller Dashboard.
2. Add one **truthful** compatibility-evidence source (donor, exact fitment, OE/OEM, or manufacturer + part number).
3. Publish it as Active through the normal UI.
4. Re-run `/admin/commerce/e2e` and require `checkout-ready listings > 0`.
5. Run Scenario G with two separate buyer sessions and retain evidence.
6. Run Scenario H with Stripe test-mode decline -> retry -> success and retain evidence.
7. Enable Supabase Auth leaked-password protection before public account creation at scale.

No Production configuration or live-money state was changed during this preflight.
