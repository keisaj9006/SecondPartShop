# SecondPart public/authenticated RPC security surface — 2026-09-15

## Scope

Read-only inspection of the deployed QA Supabase function grants, definitions and effective table privileges. No function was invoked for mutation and no database state changed.

## Public seller owner identifier

The deployed `sellers.owner_id` column is intentionally part of the public seller/member linkage rather than an accidental private-field grant. Current public server flows use it for:

- public seller/member reputation lookup;
- recognizing a viewer's own listing;
- buyer/seller marketplace block/report controls;
- pre-purchase messaging safety;
- public transaction-review reputation projection.

The corresponding public profile functions are explicitly public and bounded:

- `get_public_member_profile(handle)`;
- `get_public_member_profile_by_id(profile_id)`;
- `get_public_member_reviews(profile_id, limit)`.

They return only public marketplace identity/reputation fields such as handle, display name, bio, seller public identity, completed transaction counts, ratings and public review content. They do not return login email, phone, postcode, raw seller geolocation, payment data, shipping data or Auth credentials.

Removing `owner_id` from the current public seller projection without replacing this relationship with another bounded server-side identifier would break seller reputation, self-listing detection, report/block and messaging flows. No release-hardening change is justified solely by the presence of the UUID.

## Anon-executable functions

All public-schema functions executable by `anon` were enumerated. The surface consists of:

- category/catalogue lookup and marketplace search/page helpers;
- public compatibility/verified-fit aggregates;
- public Part Passport evidence;
- public seller/member reputation and seller-directory projections;
- public seller inventory summary;
- checkout-readiness boolean;
- seller inventory cursor under caller RLS;
- account-upgrade helper that rejects null `auth.uid()`;
- vehicle catalogue helpers.

### Privacy-sensitive definitions

`get_part_passport_evidence(part_id)` is SECURITY DEFINER but returns only donor make/model/variant/year/fuel/engine/colour plus aggregate evidence counts. It does not expose donor registration or donor notes.

`get_part_verified_fit_summary(...)` returns only distinct-buyer aggregate counts for exact/modification/did-not-fit outcomes; it does not return buyer IDs.

Distance/search SECURITY DEFINER functions may read private seller geocodes to compute marketplace distance, but their exposed return types contain only `part_id`, derived `distance_miles`, `distance_approximate`, confidence and/or count. They do not return seller latitude, longitude or postcode.

`get_public_seller_inventory_summary(seller_id)` returns only public aggregate counts and up to eight category names.

`get_seller_directory_page(...)` intentionally returns the public seller/member relationship plus public seller identity and reputation aggregates; it excludes postcode, geo and payment fields.

`seller_checkout_ready(seller_id)` exposes only a boolean needed to decide whether checkout can proceed, not payment-account/provider details.

`seller_inventory_cursor_page(...)` is SECURITY INVOKER, so anon execution remains constrained by the existing `parts` RLS active-listing policy.

`upgrade_account_to_seller()` rejects callers without `auth.uid()` and therefore cannot be used by anon despite its broad execute grant.

## Authenticated SECURITY DEFINER review

All SECURITY DEFINER functions executable by `authenticated` but not `anon` were enumerated. High-risk admin functions had already been proved to re-check `private.is_admin()` through hosted negative tests.

A definition filter then selected functions that contained neither `auth.uid()` nor `private.is_admin()` directly. Only three remained:

- `get_review_opportunities_page(...)` — wrapper over `get_review_opportunities()`;
- `get_verified_fit_opportunities_page(...)` — wrapper over `get_verified_fit_opportunities()`;
- `prepare_checkout_order_v2(...)` — validation/snapshot wrapper over `prepare_checkout_order(...)`.

Their base functions were inspected:

- `get_review_opportunities()` binds buyer and seller branches to `auth.uid()`;
- `get_verified_fit_opportunities()` requires `orders.buyer_id = auth.uid()`;
- `prepare_checkout_order()` sets `buyer := auth.uid()`, rejects unauthenticated callers, rejects buying the caller's own listing, locks the part row, verifies active/stock/checkout readiness and creates the reservation for that buyer only.

Seller CSV batch SECURITY DEFINER functions were separately inspected and all resolve a `current_seller` through `s.owner_id = auth.uid()` before returning or mutating batch data. `get_unverified_delivery_payout_reviews` requires `private.is_admin()`.

## RLS-enabled tables with no policies

The current Supabase security advisor reports nine INFO findings for `rls_enabled_no_policy`:

- `private.part_image_cleanup`;
- `public.commerce_settings`;
- `public.marketplace_search_events`;
- `public.mobile_push_devices`;
- `public.mobile_push_outbox`;
- `public.ops_client_error_rate_limits`;
- `public.payment_events`;
- `public.vehicle_lookup_cache`;
- `public.vehicle_lookup_rate_limits`.

Effective privileges were checked directly with `has_table_privilege` for SELECT, INSERT, UPDATE and DELETE. For every one of the nine tables, **all four privileges are false for both `anon` and `authenticated`**.

Therefore the lack of row policies is intentional deny-all behavior for client roles, not a public-data gap. Access is mediated through service-role/internal functions where needed.

## Advisor interpretation

At the time of this inspection the Supabase security advisor reports three classes:

1. `rls_enabled_no_policy` — INFO, now confirmed intentional deny-all for all nine tables.
2. `anon_security_definer_function_executable` — WARN, reviewed function-by-function above; the exposed functions are intentional bounded public marketplace APIs.
3. `authenticated_security_definer_function_executable` — WARN, reviewed by direct guard inspection, wrapper/base-function tracing and earlier hosted cross-role negative tests.

The remaining advisor warning that is not closed by database design is **Auth leaked password protection disabled**. This is a Supabase Auth project setting rather than SQL/RLS behavior and remains a separate external configuration gate.

## Result

**VERIFIED for the inspected deployed surface:** the Supabase advisor's RLS/SECURITY DEFINER warnings are not evidence of blanket public privilege bypass. The currently exposed public functions return bounded marketplace projections/aggregates, the authenticated mutation/private-data functions inspected bind authority to `auth.uid()`, seller ownership or `private.is_admin()`, and the nine no-policy tables grant no client table privileges.

No blanket function or table privilege revocation is recommended. Future privilege changes should remain function-specific and regression-tested because indiscriminate revocation would break intended marketplace browse, compatibility, reputation and checkout behavior.
