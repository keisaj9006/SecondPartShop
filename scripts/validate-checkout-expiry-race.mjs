import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");

const guard=read("supabase/migrations/20260911080000_checkout_expiry_provider_guard.sql");
const terminalNotification=read("supabase/migrations/20260911084500_checkout_terminal_buyer_notification.sql");
const paidGuard=read("supabase/migrations/20260911093000_confirm_checkout_paid_provider_guard.sql");
const reconciliation=read("src/lib/commerce-reconciliation.ts");
const webhook=read("src/app/api/stripe/webhook/route.ts");
const webCancel=read("src/app/checkout/cancel/route.ts");
const mobileCancel=read("src/app/api/mobile/v1/orders/[orderId]/checkout/route.ts");
const checkoutActions=read("src/app/checkout/actions.ts");
const lifecycle=read("src/lib/checkout-lifecycle.ts");
const sessionGuard=read("supabase/migrations/20260912215018_checkout_cancellation_session_guard.sql");

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
  guard.includes("p_event_type='checkout_reservation_expired' and provider_session is not null")&&
  terminalNotification.includes("p_event_type='checkout_reservation_expired' and provider_session is not null")
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
  webhook.includes('admin.rpc("cancel_checkout_order_if_session_matches"')&&
  webhook.includes('p_expected_session_id:sessionId')
 ],
 [
  "A retryable PaymentIntent failure must reconcile provider state instead of releasing inventory",
  paymentFailureBlock.includes("reconcileStripeOrder(orderId)")&&
  !paymentFailureBlock.includes('cancel_checkout_order')
 ],
 [
  "Terminal Checkout failure and expiry must notify the buyer atomically with cancellation",
  terminalNotification.includes("p_event_type='checkout.session.async_payment_failed'")&&
  terminalNotification.includes("Payment could not be completed")&&
  terminalNotification.includes("p_event_type in ('checkout.session.expired','reconciliation_checkout_expired')")&&
  terminalNotification.includes("Checkout expired")&&
  terminalNotification.includes("on conflict do nothing")&&
  terminalNotification.includes("'checkout-terminal:'||p_order_id::text")
 ],
 [
  "Terminal buyer notifications must use an account order route and avoid card/provider secrets",
  terminalNotification.includes("'/account/orders/'||p_order_id::text")&&
  !terminalNotification.toLowerCase().includes("card_number")&&
  !terminalNotification.toLowerCase().includes("client_secret")
 ],
 [
  "Paid confirmation must lock the order before mutation and reject cancelled orders",
  paidGuard.indexOf("for update")>=0&&
  paidGuard.indexOf("for update")<paidGuard.indexOf("insert into public.payment_events")&&
  paidGuard.includes("if old_payment='cancelled' then raise exception 'Cannot mark a cancelled order paid.'")
 ],
 [
  "Paid confirmation must verify the stored Stripe Checkout Session at the database boundary",
  paidGuard.includes("stored_checkout_session is null or stored_checkout_session<>p_checkout_session_id")&&
  paidGuard.includes("Stripe Checkout Session does not match the reserved order")
 ],
 [
  "Paid confirmation must remain service-role only",
  paidGuard.includes("revoke all on function public.confirm_checkout_paid")&&
  paidGuard.includes("from public,anon,authenticated")&&
  paidGuard.includes("to service_role")
 ],
 [
  "Web checkout cancellation must verify buyer ownership before service-role cancellation",
  webCancel.includes('.eq("buyer_id",user.id)')&&
  webCancel.includes('cancelCheckoutOrder({orderId,buyerId:user.id')&&
  lifecycle.includes('admin.rpc("cancel_checkout_order_if_session_matches"')
 ],
 [
  "Mobile checkout cancellation must verify buyer ownership before service-role cancellation",
  mobileCancel.includes('.eq("buyer_id",user.id)')&&
  mobileCancel.includes('cancelCheckoutOrder({orderId,buyerId:user.id')&&
  lifecycle.includes('admin.rpc("cancel_checkout_order_if_session_matches"')
 ],
 [
  "Checkout setup failure rollback must remain server-side",
  lifecycle.includes("createSupabaseAdminClient()")&&
  checkoutActions.includes('cancelCheckoutOrder({')&&
  checkoutActions.includes('eventType:"checkout_setup_failed"')
 ],
 [
  "Cancellation must verify exact session and buyer under a lock before the stock mutation",
  sessionGuard.indexOf("for update")<sessionGuard.indexOf("return public.cancel_checkout_order")&&
  sessionGuard.includes("stored_session is distinct from p_expected_session_id")&&
  sessionGuard.includes("stored_buyer is distinct from p_buyer_id")&&
  sessionGuard.includes("from public,anon,authenticated")
 ],
 [
  "Checkout URL attachment must require a returned row and preserve an existing session",
  lifecycle.includes('.is("provider_checkout_session_id",null)')&&
  lifecycle.includes('if(error||!data)throw')
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
