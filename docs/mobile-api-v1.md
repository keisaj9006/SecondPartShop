# SecondPart Mobile API v1

Base path: `/api/mobile/v1`

## Authentication

Authenticated endpoints require:

```
Authorization: Bearer <Supabase access token>
```

The server validates the access token and creates a user-scoped Supabase client. RLS and guarded RPC functions remain active.

Never send the service-role key, Stripe secrets, Firebase service-account credentials or DVSA server credentials to the mobile client.

## Response conventions

Successful JSON responses include `ok: true`.

Errors include a stable machine-readable code:

```json
{
  "ok": false,
  "error": "stable_machine_code"
}
```

Private/authenticated responses use `Cache-Control: no-store`. Selected public catalogue/marketplace responses may use short CDN caching where safe.

Mobile responses include:

- `X-Content-Type-Options: nosniff`
- `X-SecondPart-API-Version: v1`

Allowed mobile origins include Capacitor localhost origins and the canonical SecondPart web origin.

## Public marketplace / vehicle endpoints

- `GET /health`
- `GET /marketplace`
- `GET /categories`
- `GET /listings/:slug`
- `GET /vehicle-catalogue`
- `POST /vehicle-lookup`
- `GET /garages`
- `GET /members/:handle`

Marketplace query parameters mirror the web marketplace where applicable, including `q`, `category`, `condition`, `sort`, `min`, `max`, `collection`, `pc`, `cv`, `cy`, `cf`, `ce`, `fit`, `limit` and `offset`.

The registration lookup endpoint never fabricates DVSA data. Manual DfT catalogue selection remains a complete fallback when a provider is unavailable.

## Authenticated buyer / account endpoints

- `GET /me`
- `GET|PATCH /profile`
- `GET|POST /security`
- `GET|POST|DELETE /garage`
- `GET|POST /saved`
- `GET|POST|DELETE /saved-searches`
- `GET /recently-viewed`
- `GET|PATCH /notifications`
- `GET|POST|DELETE /push-devices`
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
- `GET|POST|PATCH /requests`
- `GET|POST /reviews`
- `POST /fit-feedback`
- `POST /reports`

## Buy + Fit endpoints

- `GET /garages`
- `GET|POST /fitting-requests`
- `POST /fitting-requests/:requestId`
- `GET|POST /fitting-requests/:requestId/messages`
- `GET|POST /garage-partner`
- `GET|POST /garage-partner/requests`

Buy + Fit labour quotes are separate from the parts transaction. A garage quote is not a compatibility guarantee and does not purchase the part.

## Authenticated seller endpoints

Seller routes require an authenticated account with an owned seller record and role `seller` or `admin`.

- `GET|POST /seller/profile`
- `GET|POST /seller/verification`
- `GET /seller/readiness`
- `POST /seller/payments/onboarding`
- `POST /seller/payments/refresh`
- `GET /seller/sales`
- `POST /seller/order-items/:orderItemId/fulfilment`
- `GET|POST /seller/cases`
- `GET|POST /seller/listings`
- `GET|PATCH /seller/listings/:partId`
- `GET|POST|DELETE /seller/listings/:partId/photos`
- `POST /seller/listing-assistant`
- `GET|POST|DELETE /seller/donors`
- `GET|PATCH /seller/requests`
- `GET|POST /seller/imports`
- `GET|POST /seller/imports/:batchId`

CSV import always creates drafts. It cannot directly publish arbitrary CSV rows. Ready-draft publishing is server-validated against listing readiness.

## Push delivery

The mobile client only registers or removes its device token via `/push-devices`.

The following components are server-only and are **not** mobile API endpoints:

- private device registry
- notification-to-device outbox
- FCM OAuth/service-account credentials
- FCM HTTP v1 sender
- `/api/internal/push-dispatch`

Push tap navigation uses the same internal hrefs as in-app notifications.

## Commerce rules

The mobile client never:

- computes authoritative order totals
- marks an order paid
- releases seller funds
- issues refunds
- reverses transfers
- decides dispute outcomes
- marks Stripe Connect onboarding complete without provider verification

Those operations remain server-side and provider-backed.

Checkout creates a server-side stock reservation first. Stripe checkout setup is idempotent per order. Payment confirmation is webhook/reconciliation-driven.

Buyer acceptance may trigger a server-side payout-release attempt, but the payout function independently verifies eligibility before transfer.

## Versioning

Breaking changes require a new base path, for example `/api/mobile/v2`.

Compatible additive fields may be introduced within v1. The bundled mobile app should ignore unknown JSON fields.
