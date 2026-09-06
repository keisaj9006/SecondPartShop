# SecondPart Mobile API v1

Base path: `/api/mobile/v1`

## Authentication

Authenticated endpoints require:

```
Authorization: Bearer <Supabase access token>
```

The server validates the token with Supabase Auth and creates a user-scoped Supabase client. RLS and guarded RPC functions remain active.

Never send the service-role key to a mobile client.

## Response conventions

Successful responses include `ok: true`.

Errors include:

```json
{
  "ok": false,
  "error": "stable_machine_code"
}
```

Every mobile API response sends:

- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `X-SecondPart-API-Version: v1`

Allowed mobile origins include Capacitor localhost origins and the canonical SecondPart site origin.

## Public endpoints

- `GET /health`
- `GET /marketplace`
- `GET /categories`
- `GET /listings/:slug`
- `GET /vehicle-catalogue`
- `POST /vehicle-lookup`

Marketplace query parameters mirror the web marketplace where applicable, including `q`, `category`, `condition`, `sort`, `min`, `max`, `collection`, `pc`, `cv`, `cy`, `cf`, `ce`, `limit` and `offset`.

## Authenticated buyer/account endpoints

- `GET /me`
- `GET|POST|DELETE /garage`
- `GET|POST /saved`
- `GET|PATCH /notifications`
- `GET /orders`
- `GET /orders/:orderId`
- `DELETE /orders/:orderId/checkout`
- `POST /checkout`
- `POST /order-items/:orderItemId/receipt`
- `GET|POST /cases`
- `GET|POST /cases/:caseId/evidence`
- `GET /inbox`
- `GET|POST /inbox/:conversationId`
- `POST /listings/:partId/question`
- `GET|POST /transaction-messages/:orderItemId`

## Authenticated seller endpoints

Seller routes require both an authenticated user and an owned seller record with role `seller` or `admin`.

- `GET /seller/sales`
- `POST /seller/order-items/:orderItemId/fulfilment`
- `GET|POST /seller/cases`
- `GET /seller/listings`
- `GET|POST|DELETE /seller/listings/:partId/photos`

## Commerce rules

The mobile client never:

- computes authoritative totals;
- marks an order paid;
- releases seller funds;
- issues refunds;
- reverses transfers;
- decides dispute outcomes.

Those operations remain server-side and provider-backed.

Checkout creates a server-side stock reservation first. Stripe checkout setup is idempotent per order. Payment confirmation is webhook/reconciliation-driven.

Buyer acceptance may trigger a server-side payout-release attempt, but the payout function independently verifies eligibility before transfer.

## Versioning

Breaking changes require a new base path, for example `/api/mobile/v2`.

Compatible additive fields may be introduced within v1.

The bundled mobile app should ignore unknown JSON fields.
