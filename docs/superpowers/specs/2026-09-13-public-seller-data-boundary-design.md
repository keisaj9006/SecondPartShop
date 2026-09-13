# Public Seller Data Boundary Design

## Context

SecondPart currently treats `public.sellers` as a public-readable table. RLS limits which seller rows are visible, but the table-level `SELECT` grant means an anonymous or ordinary authenticated client can request any column from a visible seller row. That includes the seller postcode and geocoding fields. The web seller page also renders the postcode, marketplace listing projections request it, and the mobile public APIs serialize the shared listing object.

## Goal

Keep the seller postcode and persisted geocoding data available for seller-owned profile workflows and server-side distance calculations while preventing those fields from being exposed through public UI, mobile public JSON, or direct PostgREST reads using `anon`/ordinary authenticated credentials.

## Data classification

Public seller columns:
- `id`
- `owner_id`
- `business_name`
- `slug`
- `location`
- `description`
- `verified_at`
- `seller_type`
- `business_kind`

Private seller columns:
- `postcode`
- `latitude`
- `longitude`
- `postcode_geocode_approximate`
- `postcode_geocoded_at`
- `account_deleted_at`

`created_at` and `updated_at` are not required by current public seller/listing projections and are not part of the public contract.

## Database boundary

Remove table-level `SELECT` from `anon` and `authenticated`, then grant column-level `SELECT` only for the public seller columns above. Existing `INSERT`/`UPDATE` privileges and RLS policies remain in force so sellers can still create and edit their own profile.

Add a `security definer` RPC named `public.get_own_seller_profile_private()` that returns the authenticated user's seller row including postcode. It must:
- use `set search_path=''`;
- derive ownership only from `auth.uid()`;
- return at most the caller's own seller row;
- be executable by `authenticated` only;
- be revoked from `public`/`anon`;
- never accept an owner id or seller id argument.

Service-role/admin server code remains able to use the table directly. Distance calculation remains server-side and continues to use service-role access to `latitude`/`longitude`.

## Application boundary

Public marketplace listing projections must stop requesting `postcode`. Public seller-by-slug reads must also omit it and map `Seller.postcode` to `null` for public objects.

`getSellerForOwner()` must use `get_own_seller_profile_private()` so the dashboard continues to receive the seller's own postcode.

Mobile seller-profile GET must use the same owner-only RPC. Mobile seller-profile PATCH must not request `postcode` in its `RETURNING` projection; it can return the already-normalized `sellerGeo.postcode` after a successful update.

Public mobile marketplace and listing-detail routes must pass listings through a defensive `toPublicListing()` serializer that forces `seller.postcode` to `null` before JSON serialization.

The public seller profile page must display only the general `location`, not the full postcode.

## Compatibility and UX

No visible marketplace capability is removed. General seller location remains public. Seller postcode remains editable in dashboard/mobile settings and remains available for distance search. Public distance results continue to expose only the calculated distance and approximation flag, not the seller's stored postcode or coordinates.

## Verification

The change is complete only when:
1. regression tests prove public profile/listing/mobile outputs do not expose postcode;
2. SQL contract tests prove `anon` and `authenticated` do not have table-level seller SELECT and do have only the approved public column grants;
3. SQL contract tests prove the owner-only RPC is authenticated-only and ownership-bound;
4. QA Supabase readback confirms the grants and RPC definition after migration;
5. owner dashboard/mobile profile flows still have access to their own postcode;
6. full GitHub Actions, PostgreSQL concurrency/25k jobs, typecheck, build and exact-SHA Vercel Preview are green.

## Non-goals

This change does not alter seller discovery ranking, compatibility logic, distance formulas, seller verification policy, checkout, payouts, or the public meaning of the seller `location` field.
