# Mobile buyer orders retain sold-item identity — 2026-09-18

Branch: `rebuild-nextjs`

This checkpoint covers buyer order list/detail serialization in the mobile API after a listing becomes sold and is hidden by public `parts` RLS. It does not weaken RLS, change order ownership, alter transaction state, Stripe configuration, Production or `main`.

## Root cause

Web buyer order history had already been hardened after a real Stripe test purchase exposed that sold listings can be correctly hidden by public `parts` RLS while the buyer still needs the purchased item identity.

The mobile order endpoints did not receive that protection:

- `GET /api/mobile/v1/orders`;
- `GET /api/mobile/v1/orders/[orderId]`.

Both queried `parts(title,slug)` through the buyer session and then dropped the order item when the embedded relation was `null`.

Because the mobile order query itself was correctly buyer-scoped first, the safe repair is to recover only minimal item identity for `part_id` values already present in an authorized buyer order.

## TDD RED

Regression commit:

- `ffc348d8950e0b6b5cb5fb224c3805f1f6376ca3`
- GitHub Actions run: `35354167211`

Expected RED:

- total tests: 600;
- 598 PASS;
- 2 FAIL;
- mobile order list returned zero items for an authorized sold part;
- mobile order detail returned zero items for an authorized sold part;
- the negative inaccessible-order test already passed and confirmed no privileged lookup was performed when the buyer could not read the order.

## GREEN implementation

Implementation commits:

- list: `4f2cb7a0290e69d8cb8dbd202743e00851618663`;
- detail / final application SHA: `78bb46883f553c0cbc2efc95895e25a51881cd37`.

Both mobile buyer order queries now include `part_id`. After the buyer-scoped order query succeeds, only order items whose public `parts` relation is missing are collected. For those exact IDs, a server-side lookup retrieves only:

- `id`;
- `title`;
- `slug`.

The fallback is never run for an inaccessible/missing order. If the minimal recovery lookup fails, the API returns HTTP 503 rather than silently deleting purchased items from the response.

No stock, listing status, seller, payment, order or Auth record is changed.

## Final verification

GitHub Actions run `35354417869`:

- `validate`: PASS;
- `last-stock-concurrency`: PASS;
- `marketplace-scale-postgres`: PASS;
- tests: **600/600 PASS**, 0 FAIL;
- lint: PASS;
- typecheck: PASS;
- release/commerce validators: PASS;
- production Next.js build: PASS; compiled successfully in 9.8s.

Vercel Preview:

- deployment: `dpl_A15GTydkUuz3KkKgN9FM4RUaaBBN`;
- exact URL: `https://second-part-shop-mfco8y5w0-joannakwapis11-5369.vercel.app`;
- stable branch alias: `https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app`;
- state: READY.

Fresh read-only health smoke on exact deployment and branch alias returned HTTP 200 with `backendReady:true`.

## Scope limit

This closes sold-part identity loss for the mobile buyer order list/detail paths. Seller identity after seller-account deletion is a separate retained-transaction/privacy boundary and is not claimed closed here.
