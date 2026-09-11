import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");

const guard=read("supabase/migrations/20260911080000_checkout_expiry_provider_guard.sql");
const reconciliation=read("src/lib/commerce-reconciliation.ts");
const webhook=read("src/app/api/stripe/webhook/route.ts");

const paymentFailureStart=webhook.indexOf('if(event.type==="payment_intent.payment_failed")');
const disputeStart=webhook.indexOf('if(event.type==="charge.dispute.created")');
const paymentFailureBlock=paymentFailureStart>=0&&disputeStart>paymentFailureStart
 ?webhook.slice(paymentFailureStart,disputeStart)
 :"";

const checks=[
 [
  "Database expiry must ignore orders that already have a Stripe Checkout Session",
  guard.includes("and o.provider_checkout_session_id is null")
 ],
 [
  "Generic local expiry must refuse to cancel a provider-backed checkout",
  guard.includes("p_event_type='checkout_reservation_expired' and provider_session is not null")
 ],
 [
  "Provider-backed reconciliation must retrieve the Stripe Checkout Session before deciding",
  reconciliation.includes("await getCheckoutSession(sessionId)")
 ],
 [
  "Reconciliation may cancel only after Stripe reports the session expired",
  reconciliation.includes('if(session.status==="expired")')&&
  reconciliation.includes('p_event_type:"reconciliation_checkout_expired"')
 ],
 [
  "Stripe expiry/final async failure events must match the reserved Checkout Session before cancellation",
  webhook.includes("checkoutSessionMatchesOrder")&&
  webhook.includes('event.type==="checkout.session.expired"||event.type==="checkout.session.async_payment_failed"')&&
  webhook.includes('admin.rpc("cancel_checkout_order"')
 ],
 [
  "A retryable PaymentIntent failure must reconcile provider state instead of releasing inventory",
  paymentFailureBlock.includes("reconcileStripeOrder(orderId)")&&
  !paymentFailureBlock.includes('cancel_checkout_order')
 ],
 [
  "Paid Stripe sessions must still flow through confirm_checkout_paid",
  reconciliation.includes('if(session.payment_status==="paid")')&&
  reconciliation.includes('admin.rpc("confirm_checkout_paid"')&&
  webhook.includes('admin.rpc("confirm_checkout_paid"')
 ]
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} checkout expiry race invariant(s) failed.`);
 process.exit(1);
}

console.log("\nCheckout expiry/provider reconciliation guard passed.");
