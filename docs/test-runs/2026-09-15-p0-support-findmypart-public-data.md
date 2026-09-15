# SecondPart support, Find My Part and public seller-data evidence — 2026-09-15

## Scope and safety

Verification used `rebuild-nextjs`, Vercel Preview and QA Supabase (`etkupijfdznljimrfyct`). All hosted database mutation probes were wrapped in explicit transactions followed by `ROLLBACK`. No real support email, customer message, seller lead or Find My Part request was left behind.

## 1. Public seller data contract

The live `public.sellers` table contains both public marketplace fields and private operational fields, including postcode and geocoded latitude/longitude. RLS alone would not hide individual columns, so the effective column grants were inspected.

The deployed grants intentionally expose a narrow public/authenticated read projection:

- anon SELECT: `id`, `owner_id`, `business_name`, `slug`, `location`, `description`, `verified_at`, `seller_type`, `business_kind`;
- authenticated SELECT: the same public fields;
- neither anon nor authenticated has SELECT on `postcode`, `latitude`, `longitude`, `postcode_geocode_approximate`, `postcode_geocoded_at` or `account_deleted_at`.

`has_table_privilege(...,'select')` is false for both anon and authenticated because seller reads are granted column-by-column. The public/authenticated row policies additionally exclude rows after `account_deleted_at` except for admins.

**Result:** the earlier concern that a public caller could read full seller postcode/geolocation directly from `sellers` is not present on the deployed QA database. The protection is database-enforced, not merely UI hiding.

## 2. Customer support conversation boundary

The application already contains a complete in-app support journey:

- `/contact` exposes account-linked support requests for signed-in users and lists their current status;
- `/contact/[requestId]` requires the current user, loads the request only when `profile_id` matches, shows the customer-visible conversation and never queries internal notes;
- open/in-progress/resolved requests can receive user replies; replying to `resolved` reopens it to `open`;
- `closed` requests are final/read-only;
- admin customer-visible replies and internal admin notes are stored separately.

### Hosted RLS proof

A rollback-only support request with one customer-visible admin reply and one internal note was inserted for the QA buyer.

Assertions on the deployed RLS showed:

- request owner saw the request and the customer-visible reply;
- request owner saw zero rows from `support_request_internal_notes`;
- unrelated authenticated buyer saw zero request rows, zero visible messages and zero internal notes.

### Hosted reply RPC proof

The deployed `reply_to_support_request(uuid,text)` function is executable by authenticated/service role but re-checks `auth.uid()` against `support_requests.profile_id` inside the SECURITY DEFINER function.

Rollback-only probes proved:

- owner reply to an open request succeeds and remains open;
- owner reply to a resolved request succeeds and reopens it to open;
- closed request rejects a reply;
- unrelated authenticated user is denied through the same not-found ownership boundary.

**Result:** support request visibility, reply ownership, resolved-reopen semantics, closed finality and internal-note privacy are VERIFIED on hosted PostgreSQL for the exercised boundary.

### Public support email

`getPublicSupportEmail()` renders a public address only when `NEXT_PUBLIC_SUPPORT_EMAIL` contains a syntactically valid email. The current branch Preview `/contact` renders no `Public support email` section, while the same page code would render that section whenever the environment value is valid.

**Result:** in-app authenticated support is implemented and verified, but the public/Play/privacy support email is currently **NOT effectively configured on Preview**. A real monitored mailbox plus environment configuration/operational owner remains an external release gate.

## 3. Find My Part ownership and lead visibility

The deployed data contract is separated between buyer-owned requests and seller-scoped matched leads:

- `part_requests` RLS is owner-only for authenticated SELECT/INSERT/UPDATE/DELETE;
- `seller_part_request_matches` SELECT is limited to the owning seller account or admin;
- `buyer_part_request_match_counts_for_ids` only counts open requests whose `profile_id = auth.uid()`;
- `seller_part_request_lead(request_id)` resolves the current seller by `owner_id = auth.uid()` and returns request free text only when that seller has an open match for that request;
- the buyer response projection in `src/lib/data/part-requests.ts` only includes active linked listings and explicitly selects `id`, request link, slug, title, price, condition and bounded seller public identity. It does not select registration, postcode, seller owner ID, phone or description.

### Hosted rollback proof

A temporary open buyer request plus one open match to the QA seller was inserted only inside a transaction.

Assertions proved:

- buyer saw exactly its own request and match count;
- matched seller saw exactly the matching lead and its request text;
- unrelated authenticated user saw neither the request nor seller lead.

The transaction was rolled back, leaving hosted QA with zero Find My Part requests.

**Result:** buyer ownership, seller-match authorization and outsider isolation are VERIFIED on hosted PostgreSQL. A real request → seller response → buyer quote/listing journey is still a separate fixture/UI E2E and is not fabricated here. DVSA remains external; manual vehicle entry remains the supported fallback.
