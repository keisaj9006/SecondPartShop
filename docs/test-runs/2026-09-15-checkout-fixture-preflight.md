# SecondPart checkout fixture preflight — 2026-09-15

## Scope

This preflight determines whether the current hosted QA state can support the remaining real provider/UI Stripe RC scenarios without fabricating compatibility or bypassing normal publication rules.

No Production environment or real-money transaction was used. No existing financial/history fixture was modified.

## Hosted QA inventory observations

Active hosted listings were inspected together with seller payout linkage and catalogue fitment counts.

Observed boundary:

- current active listings have stock, but their seeded sellers do not have a linked payout account in `seller_payment_accounts`;
- the active listings inspected have zero catalogue fitments;
- therefore none of those active listings is presently a truthful checkout-ready candidate for a fresh provider/UI adverse-checkout or full last-stock race scenario.

A separate QA seller does have an existing Stripe Connect account and owns draft QA listings. Its current drafts include the deliberately named checkout test fixture, but that fixture has no donor vehicle, exact catalogue fitment, OE/OEM number, or manufacturer + part-number pair sufficient for normal publication under the application rules.

## Deployed checkout contract

The hosted `seller_checkout_ready(p_seller_id)` function requires:

- seller not privacy-deleted;
- `seller_payment_accounts.onboarding_status = 'complete'`;
- `seller_payment_accounts.transfers_enabled = true`.

The deployed `prepare_checkout_order_v2(...)` validates a checkout vehicle snapshot only when a vehicle is supplied. Checkout without a selected vehicle is allowed by this database function.

The application `startCheckout` action independently re-checks seller payout readiness through the Stripe-backed sync path before reserving stock. If a vehicle is supplied, the action re-runs compatibility and requires acknowledgement for `family_match` or `unverified` outcomes.

This means a no-vehicle checkout is a valid product path; it is not an acceptable reason to bypass seller readiness or listing publication constraints.

## Normal publication contract

The seller listing action requires an active listing to have:

- stock >= 1;
- at least one real product photo;
- seller checkout readiness;
- compatibility evidence consisting of at least one of: donor vehicle, exact catalogue fitment, OE/OEM number, or manufacturer + part number.

The current dedicated QA checkout draft does not satisfy the compatibility-evidence condition. Direct SQL promotion from `draft` to `active` would bypass the product contract, so it was deliberately not performed.

No synthetic fitment, OEM number, donor vehicle, or part number was invented to force the scenario through.

## Authenticated UI boundary

The remaining provider/UI scenarios also require a legitimate authenticated QA buyer/seller session in Preview. The current connected tooling does not expose a safe Auth-admin action to create a disposable confirmed user, and direct writes into `auth.users` are not an acceptable substitute for the real authentication path.

Therefore the following remain unsigned rather than falsely promoted to PASS:

- Stripe decline -> retry provider/UI scenario;
- provider-confirmed abandon/expiry scenario;
- simultaneous real Preview/Stripe last-stock race.

## Classification

- **VERIFIED:** code/database guards, seller-readiness contract, normal publication evidence requirement, no-vehicle checkout contract, and database-level last-stock concurrency.
- **BLOCKED / AUTHENTICATED QA FIXTURE:** fresh provider/UI adverse checkout and full provider/UI last-stock evidence need a disposable truthful published listing plus legitimate authenticated QA session.
- **NOT PERMITTED:** direct SQL publication that bypasses the seller form rules, fabricated compatibility evidence, or manual writes into `auth.users`.
