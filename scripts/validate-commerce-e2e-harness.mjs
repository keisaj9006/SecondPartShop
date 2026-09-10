import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const diagnostic=read("src/lib/data/commerce-e2e.ts");
const page=read("src/app/admin/commerce/e2e/page.tsx");
const runbook=read("docs/commerce-e2e-runbook.md");
const sellerPaymentSync=read("src/lib/seller-payment-sync.ts");
const sellerPaymentActions=read("src/app/dashboard/payments/actions.ts");
const sellerPaymentPage=read("src/app/dashboard/payments/page.tsx");
const stripeConnect=read("src/lib/stripe-connect.ts");

const forbiddenMutations=[".insert(",".update(",".upsert(",".delete(","auth.admin.deleteUser","cancel_checkout_order","claim_order_item_payout_release","mark_order_item_payout_released"];
const isReadOnly=forbiddenMutations.every(token=>!diagnostic.includes(token));

const checks=[
 ["Commerce E2E diagnostic must remain read-only",isReadOnly],
 ["Diagnostic must require a valid order UUID",diagnostic.includes("isUuid(orderId)")],
 ["Preflight must check payout-ready sellers",diagnostic.includes('onboarding_status==="complete"')&&diagnostic.includes("transfers_enabled")&&diagnostic.includes("payouts_enabled")],
 ["Paid orders must require Stripe payment references",diagnostic.includes("provider_payment_intent_id")&&diagnostic.includes("provider_charge_id")&&diagnostic.includes("paid_at")],
 ["Paid orders must require persisted payment/audit events",diagnostic.includes('event_type==="checkout_paid"')&&diagnostic.includes('event_type==="payment_confirmed"')],
 ["Order/item money snapshots must reconcile",diagnostic.includes("expectedSubtotal")&&diagnostic.includes("expectedShipping")&&diagnostic.includes("expectedFees")],
 ["Shipping fulfilment must verify dispatch evidence",diagnostic.includes("dispatched_at")&&diagnostic.includes("tracking_number")],
 ["Buyer receipt must verify receipt timestamps",diagnostic.includes("buyer_received_at")&&diagnostic.includes("delivered_at")],
 ["Payout scheduling must require release eligibility",diagnostic.includes("release_eligible_at")],
 ["Active transaction cases must gate payout",diagnostic.includes("activeCaseStatuses")&&diagnostic.includes("unsafeRelease")],
 ["Released payout must require transfer evidence",diagnostic.includes("provider_transfer_id")&&diagnostic.includes("funds_released_at")],
 ["Unresolved payout rollback must fail verification",diagnostic.includes("payout_rollback_required")],
 ["Admin page must explicitly describe verifier as read-only",page.includes("Read-only verification")&&page.includes("never advances fulfilment")],
 ["Admin page must expose preflight blockers",page.includes("readyForRealE2E")&&page.includes("preflight.blockers")],
 ["Canonical Stripe seller sync must persist complete payout readiness",sellerPaymentSync.includes("payouts_enabled:active")&&sellerPaymentSync.includes("transfers_enabled:active")],
 ["Manual Stripe refresh must persist the same payout readiness",sellerPaymentActions.includes("payouts_enabled:complete")&&sellerPaymentActions.includes("transfers_enabled:complete")],
 ["Stripe onboarding return must trigger an automatic status sync",sellerPaymentPage.includes("syncSellerPaymentAccount")&&sellerPaymentPage.includes("returned&&configured")],
 ["Stripe recipient creation must require an idempotency key",stripeConnect.includes("idempotencyKey:string")&&stripeConnect.includes('"Idempotency-Key"')],
 ["Seller onboarding must use a stable seller-scoped idempotency key",sellerPaymentActions.includes("secondpart-recipient-${seller.id}")],
 ["Seller onboarding and sync failures must be monitored",sellerPaymentActions.includes("seller_stripe_onboarding_start_failed")&&sellerPaymentActions.includes("seller_stripe_status_sync_failed")],
 ["Runbook must cover happy path and major failure paths",runbook.includes("Scenario A")&&runbook.includes("Scenario D")&&runbook.includes("Scenario E")&&runbook.includes("Scenario F")&&runbook.includes("Scenario G")],
 ["Runbook must prohibit manual state forcing",runbook.includes("never manually forced")&&runbook.includes("Do not simulate readiness")],
 ["Runbook must require provider transfer evidence",runbook.includes("provider_transfer_id")&&runbook.includes("seller_transfer_released")],
 ["Runbook must include webhook idempotency",runbook.includes("Webhook idempotency gate")],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} commerce E2E harness invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSecondPart commerce E2E harness baseline passed.");
