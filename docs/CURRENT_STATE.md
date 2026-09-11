# SecondPart — Current State

Snapshot basis: `rebuild-nextjs`, 11 September 2026.

This file is a high-level navigation document. The repository's current canonical runbooks and launch documents are more authoritative for subsystem details.

## Repository / branch

- Repo: `keisaj9006/SecondPartShop`
- Active branch: `rebuild-nextjs`
- Legacy `main` must remain untouched.

## Engineering baseline

The rebuild is substantially implemented.

The current branch includes:
- modern Next.js marketplace frontend
- Supabase Auth/Postgres/Storage/Edge Functions
- RLS-protected application tables
- buyer/seller authentication and account modes
- public listings/product details
- categories and search
- vehicle-first search with registration provider support and manual fallback
- SecondPart Garage
- fitment/compatibility confidence
- OE/OEM/part-number-aware search
- saved parts/searches/recently viewed
- seller profiles and listing management
- seller photos and bulk import foundations
- donor vehicles
- Part Request / seller demand-lead foundations
- notifications
- trust/moderation/reporting
- reviews and Verified Fit foundations
- purchases and seller sales/payout hubs
- order/payment/fulfilment/payout state foundations
- Stripe Connect seller onboarding foundations
- legal/help/privacy/support/account security
- operational account-deletion processor
- monitoring
- Android/Google Play release infrastructure

## Important change from older project conversations

Older conversations may describe payments as "not implemented yet".

That is now stale as a general statement.

The current repo contains substantial commerce implementation and safety hardening. Remaining work is increasingly about:
- real test-mode E2E proof,
- edge-case validation,
- provider configuration,
- physical-device verification,
- production release configuration,
- legal/policy completion,
- liquidity.

Always inspect current code and `docs/launch-readiness.md` before assuming a commerce feature is missing.

## Recent commerce hardening

Current canonical launch documentation records implemented protections including:
- row-serialized stock reservation
- checkout expiry/provider guard
- terminal checkout cancellation with buyer notification
- paid confirmation guard against cancelled/mismatched sessions
- retryable Stripe failure protection
- payout transfer recovery safeguards
- silent-buyer policy
- operational account-deletion implementation
- structured monitoring

Do not regress these.

## Current real-provider / QA blockers

Current launch readiness identifies external or E2E work still needed, including:
- real Stripe test-mode full transaction
- cancellation/refund/return/case/payment-dispute/payout-reversal E2E
- concurrency stock-reservation scenario
- declined-payment then successful-retry scenario
- destructive account-deletion E2E on disposable account
- Supabase leaked-password protection setting
- final legal review
- production support mailbox
- production domain/origin
- Play signing / Play Console / Firebase production setup
- physical Android RC QA
- physical FCM E2E

## Android / Play

The production direction is established and already significantly implemented:
- dedicated package
- AAB workflow
- signing separation
- SDK target/compile baseline
- deep link / app link work
- icon/splash production assets
- permission audit
- evidence pack
- production-origin preflight
- physical RC matrix

Remaining work is release configuration and real-device/provider evidence, not a wholesale Android rebuild.

## Marketplace liquidity

Engineering maturity is significantly ahead of marketplace liquidity.

The latest canonical snapshot records very low live marketplace supply/activity relative to launch targets.

Current launch gate target remains broadly:
- ~30 large active sellers
- 15–20 breakers
- >= 25,000 live listings
- acceptable search fill rate
- Find My Part proven with real sellers
- protected-payment/delivery flows proven
- reviews only from genuine verified beta transactions
- Buy + Fit either meaningfully covered or clearly staged

## Recent user-facing product direction from project conversations

Preserve these current UX/product requirements:
- Garage "Add vehicle" must permit selecting a genuinely new vehicle rather than forcing the previously selected one.
- Home and Garage should expose consistent vehicle selection.
- `Show only parts that fit this vehicle` should be explicit and understandable.
- When the compatibility filter is off, users should be able to browse wider inventory.
- Buyer and Seller account modes should remain visible.
- Sellers can also buy.
- Bottom/mobile navigation should remain coherent and predictable.
- Compatibility must be enforced server-side for protected purchase flows, not only through UI.
- Reviews + Verified Fit remain important trust features.
- Image upload uses compressed/validated image handling and should preserve existing security checks.

## Overall state

The correct interpretation is:

**SecondPart is no longer an early prototype.**

The next phase is:
1. finish release-critical E2E and provider proof,
2. close production/Android/legal gates,
3. build real seller/inventory liquidity,
4. use research selectively to strengthen fitment, Find My Part and seller operations without destabilizing working commerce.
