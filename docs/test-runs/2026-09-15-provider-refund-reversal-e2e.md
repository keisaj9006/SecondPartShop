# SecondPart provider refund + reversal E2E — 2026-09-15

## Scope

Preview only, Stripe sandbox/test mode only, branch `rebuild-nextjs`. No Production or real-money operations were used.

## Fixture

- Buyer order: `6b816b03-9d35-4a15-a4f9-cad7357644f3`
- Order item: `ca8e4d20-3761-4bb4-b5e6-3207ee2a2728`
- QA listing: `door left rear white used`
- Amount: `£89.00 GBP`
- Stripe PaymentIntent: `pi_3UFtH42RWsyIBCbK1zF9aJ9P`
- Stripe seller transfer: `tr_3UFtH42RWsyIBCbK1TuMU5Y0`
- Transaction case: `e924aa7f-f117-4f30-849b-de611da11bdf`

## Genuine app/provider flow observed

1. Seller published the QA listing through normal Seller UI.
2. QA Buyer completed Stripe Checkout in test mode with `£89.00 GBP`.
3. Stripe Checkout completed and the PaymentIntent succeeded.
4. Supabase recorded the order as paid and consumed the final unit of stock.
5. Seller marked the collection order ready for collection through normal Seller UI.
6. Buyer used `Accept item & complete` through normal Buyer UI.
7. SecondPart released a real Stripe sandbox transfer to the connected seller account.
8. Buyer opened a normal return/refund case through Buyer UI.
9. QA Admin selected `Refund without return` through Admin Commerce UI.
10. SecondPart reversed the released seller transfer before refunding the buyer.
11. Stripe created one successful refund and Supabase finalized the transaction as refunded.

## Provider evidence

### Seller transfer

- Transfer ID: `tr_3UFtH42RWsyIBCbK1TuMU5Y0`
- Amount: `8900` pence
- Currency: `gbp`
- Platform balance transaction type: `transfer`

### Transfer reversal

- Durable Supabase reversal correlation: `trr_1UFvjo2RWsyIBCbKFIWfKYEg`
- Stripe balance transaction: `txn_1UFvjo2RWsyIBCbKJPFXZakc`
- Amount: `8900` pence
- Currency: `gbp`
- Reporting category: `transfer_reversal`
- Type: `transfer_refund`
- Description: `REFUND FOR TRANSFER`

### Buyer refund

- Refund ID: `re_3UFtH42RWsyIBCbK1tEHtQBa`
- Amount: `8900` pence
- Currency: `gbp`
- PaymentIntent: `pi_3UFtH42RWsyIBCbK1zF9aJ9P`
- Status: `succeeded`

## Durable Supabase final state

- Case status: `resolved`
- Case resolution: `full_refund`
- `provider_refund_id = re_3UFtH42RWsyIBCbK1tEHtQBa`
- Item fulfilment: `refunded`
- Item payout status: `reversed`
- `provider_transfer_id = tr_3UFtH42RWsyIBCbK1TuMU5Y0`
- `provider_transfer_reversal_id = trr_1UFvjo2RWsyIBCbKFIWfKYEg`
- Order payment status: `refunded`
- Order status: `refunded`

## Provider retry / idempotency proof

A temporary Preview-only QA control invoked the same production core `refundTransactionCase` again for the already-resolved case after provider and database state were finalized.

Observed retry request:

- `POST /api/qa/admin-bootstrap -> 303`
- Followed by `GET /admin/commerce/e2e -> 200`

The core returned the existing resolved-refund path (`already_refunded`) rather than creating another provider operation.

Post-retry evidence:

- Stripe refund count for `pi_3UFtH42RWsyIBCbK1zF9aJ9P`: exactly `1`
- Refund ID unchanged: `re_3UFtH42RWsyIBCbK1tEHtQBa`
- Transfer-reversal evidence unchanged: one `£89.00` reversal associated with transfer `tr_3UFtH42RWsyIBCbK1TuMU5Y0`
- Supabase `provider_refund_id` unchanged
- Supabase `provider_transfer_reversal_id` unchanged
- Case remains `resolved/full_refund`
- Order remains `refunded`

Result: provider-level retry/idempotency boundary is VERIFIED for this observed refund/reversal scenario.

## Additional defect found and fixed during E2E

The first successful Stripe Checkout returned to a stale configured Preview hostname rather than the Preview hostname that initiated checkout. Payment and webhook authority remained correct, but the browser lost its authenticated session because cookies do not cross Vercel deployment hostnames.

The checkout return-origin logic was hardened so Preview Checkout success/cancel URLs use only a trusted current Vercel deployment/branch origin while Production remains pinned to the canonical Production origin. The final checkout-return fix passed the full QA workflow before this provider flow continued.

## QA bootstrap cleanup

A dedicated `SecondPart QA Admin` was created only for this provider E2E through Supabase Auth Admin API. After the test:

- QA Admin Auth account count: `0`
- QA Admin/admin profile count: `0`
- Temporary Preview bootstrap route removed from the branch
- Temporary Preview bootstrap page removed from the branch
- Temporary bootstrap test removed from the branch

The production refund implementation and the permanent regression tests remain in place.
