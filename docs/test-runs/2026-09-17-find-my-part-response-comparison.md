# SecondPart Find My Part response comparison — 2026-09-17

## Scope

This evidence records the bounded buyer-side improvement to existing Find My Part responses on `rebuild-nextjs`. It does not introduce a second quote subsystem, change marketplace payment rules, alter Supabase schema, or touch Production.

The existing request-to-listing model remains authoritative: sellers respond to a buyer request by creating a normal marketplace listing linked through `source_request_id`; the buyer sees only active linked listings.

## TDD RED

The existing regression file `scripts/test-part-request-response-delivery.mjs` was extended first with the intended comparison contract.

RED commit:

- SHA `22bbbf3d3aa298f05fb02652074f38ced70156b2`
- GitHub Actions `35209102315`
- result: expected test failure before implementation
- exactly three new contract assertions failed: missing comparison fields in the response type, missing comparison fields in the loader projection, and missing multiple-response comparison UX

No implementation was added before this RED boundary.

## Implementation

Final application SHA:

- `62fba262a4351d30503441ec73d57cc90211564d`

The buyer response projection now exposes only the decision fields needed to compare normal public listings:

- part price;
- shipping price;
- delivered total;
- condition;
- dispatch time;
- warranty;
- public seller business name;
- verified-seller state;
- listing slug/title.

The loader still:

- returns only listings linked to the buyer's request through `source_request_id`;
- returns only `active` listings;
- caps responses at six per request;
- uses an explicit seller projection limited to `business_name` and `verified_at`.

The response projection does not add registration, postcode, owner ID, email, phone, description, latitude or longitude.

## Buyer UX

On `/requests`:

- one active response is labelled `Seller response`;
- two or more active responses are labelled `Compare seller responses`;
- each response shows `Part price`, `Delivery`, `Delivered total`, `Condition`, `Dispatch`, `Warranty`, seller verification and `View part`;
- `Delivered total` is calculated from the listing part price plus listing shipping price;
- fitment is deliberately not inferred by the comparison surface: the buyer is told to open the listing and verify fitment before purchase.

This keeps the comparison useful without turning a request match into an unsupported compatibility guarantee.

## Verification

GitHub Actions for final SHA:

- run `35209338887`
- `validate`: SUCCESS
- lint: PASS
- typecheck: PASS
- full `npm test`: PASS
- all release validators: PASS
- production build: PASS
- `last-stock-concurrency`: PASS
- `marketplace-scale-postgres` 100k proof: PASS

Exact Vercel Preview:

- deployment `dpl_BtCP66VCyaU6Hg5dB15wCiZdxbAY`
- URL `https://second-part-shop-ooy1rbil9-joannakwapis11-5369.vercel.app`
- state `READY`
- Git SHA `62fba262a4351d30503441ec73d57cc90211564d`

## Classification

**VERIFIED — engineering + exact Preview deployment boundary.**

The feature is source-tested, integrated with the full release pipeline and deployed READY on the exact application SHA.

A fresh authenticated buyer session containing multiple live seller responses was not manufactured solely for visual evidence, so this note does not claim a new hosted authenticated multi-response fixture E2E. Existing request ownership and hosted matching boundaries remain covered by earlier Find My Part evidence.
