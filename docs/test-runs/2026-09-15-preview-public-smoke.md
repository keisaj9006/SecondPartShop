# SecondPart public Preview smoke — 2026-09-15

## Scope

Anonymous/read-only smoke verification of the current `rebuild-nextjs` Preview branch alias:

`https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`

No sign-in, mutation, checkout, email, push or provider operation was performed.

## Public routes exercised

The following routes rendered successfully on Preview:

- `/` — HTTP 200, marketplace shell and public browse content present;
- `/parts/dq250-complete-gearbox-02e-qa-offer` — HTTP 200, full active listing detail rendered;
- `/seller/west-coast-auto-salvage` — HTTP 200, public seller profile rendered with bounded public identity/location/reputation data;
- `/contact` — HTTP 200, in-app support page rendered;
- `/privacy` — HTTP 200, Privacy page rendered;
- `/sellers` — HTTP 200, public seller directory rendered;
- `/garages` — HTTP 200, Buy + Fit directory/recruitment empty-state rendered correctly;
- previously removed QA actor-switch page and API route remain HTTP 404 on the clean deployment.

Preview continues to emit `noindex` / `noindex, nofollow` metadata as expected for non-production public pages.

## Listing-race investigation

A first candidate listing slug (`vauxhall-astra-k-coolant-expansion-tank-cap`) disappeared between the initial database listing query and the subsequent HTTP smoke request. The page consequently rendered the application's normal unavailable/404 boundary.

This was investigated before treating it as a defect:

1. the earlier read had shown the row as active;
2. the subsequent database read found no row under that slug even with privileged database access;
3. a freshly queried active listing (`dq250-complete-gearbox-02e-qa-offer`) immediately rendered normally over anonymous Preview with complete listing content.

Therefore the first result was a concurrent QA-fixture data change, not an RLS, Next.js routing or public listing-read defect. No code change was made.

## Public-data observations

- Seller profile/directory output exposes bounded marketplace location/reputation data and did not expose seller postcode, raw latitude/longitude, payment identifiers or private account fields.
- `/garages` exposes only the public Buy + Fit discovery/recruitment flow and currently has no approved workshop rows to display.
- `/contact` still renders no public support-email block, corroborating the already-recorded external `NEXT_PUBLIC_SUPPORT_EMAIL` / monitored-mailbox configuration gate.

## Runtime observation

Vercel Preview runtime logs were queried immediately after the route smoke:

- `error` + `fatal`, previous 1 hour: no logs found;
- HTTP `5xx`, previous 1 hour, grouped by request path: zero rows.

This is a bounded observation of that one-hour Preview window, not a statement that future runtime failures are impossible.

## Result

**PASS for the anonymous public Preview smoke boundary:** current marketplace home, active listing detail, seller profile/directory, Contact, Privacy and Garages routes render without observed 5xx/runtime errors. The one transient missing listing was traced to a concurrent fixture deletion/state change rather than application failure.

This smoke does not replace authenticated buyer/seller, physical Android, provider-payment or Production-domain evidence.
