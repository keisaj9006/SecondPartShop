import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { expireCheckoutSession,getCheckoutSession,getCreatedCheckoutSessionId,type StripeCheckoutSession } from "@/lib/stripe-payments";
import { reconcileStripeOrder } from "@/lib/commerce-reconciliation";
import { reportOperationalError } from "@/lib/ops-monitoring";

type CancellationResult="cancelled"|"not_cancellable"|"unavailable";

// Stripe's expire response is authoritative. An error can mean the session
// completed concurrently or expired before our request: read it again once.
async function closeSession(orderId:string,sessionId:string){
 let session=await getCheckoutSession(sessionId);
 const matches=()=>session.id===sessionId&&session.client_reference_id===orderId&&session.metadata?.order_id===orderId;
 if(!matches())throw new Error("Checkout session identity mismatch.");
 if(session.status==="open"&&session.payment_status==="unpaid"){
  try{session=await expireCheckoutSession(sessionId);}
  catch{session=await getCheckoutSession(sessionId);}
 }
 if(!matches())throw new Error("Checkout session identity mismatch.");
 return session;
}

export async function cancelCheckoutOrder(input:{orderId:string;buyerId:string;eventType:string;setupSessionId?:string}):Promise<CancellationResult>{
 let operation="order_read";
 try{
  const admin=createSupabaseAdminClient();
  const {data:order,error}=await admin.from("orders")
   .select("id,payment_status,provider_checkout_session_id")
   .eq("id",input.orderId).eq("buyer_id",input.buyerId).maybeSingle();
  if(error)throw new Error("Checkout order read failed.");
  if(!order)return "not_cancellable";
  if(!input.setupSessionId&&!["unpaid","requires_action","cancelled"].includes(order.payment_status))return "not_cancellable";

  const sessionId=input.setupSessionId??order.provider_checkout_session_id;
  if(sessionId){
   operation="provider_close";
   const session=await closeSession(input.orderId,sessionId);
   if(session.payment_status==="paid"||session.status==="complete"){
    operation="payment_reconciliation";
    if(order.provider_checkout_session_id===sessionId)await reconcileStripeOrder(input.orderId,sessionId);
    else await reportOperationalError({severity:"critical",component:"checkout",event:"checkout_orphan_payment_requires_reconciliation",error:new Error("An unattached checkout session completed."),context:{operation,orderId:input.orderId,stripeSessionId:sessionId}});
    return "not_cancellable";
   }
   if(session.status!=="expired"||session.payment_status!=="unpaid")throw new Error("Checkout expiry could not be confirmed.");
  }
  // A failed attachment can leave an orphan. Closing it must never cancel a
  // different session that won the attachment race.
  if(input.setupSessionId&&order.provider_checkout_session_id!==null&&order.provider_checkout_session_id!==input.setupSessionId)return "not_cancellable";
  operation="database_cancel";
  const {data:cancelled,error:cancelError}=await admin.rpc("cancel_checkout_order_if_session_matches",{
   p_order_id:input.orderId,
   p_buyer_id:input.buyerId,
   p_expected_session_id:order.provider_checkout_session_id,
   p_event_type:input.eventType
  });
  if(cancelError)throw new Error("Checkout cancellation write failed.");
  return cancelled===true?"cancelled":"not_cancellable";
 }catch{
  await reportOperationalError({component:"checkout",event:"checkout_cancellation_unavailable",error:new Error("Checkout cancellation could not be confirmed."),context:{operation,orderId:input.orderId}});
  return "unavailable";
 }
}

export async function attachCheckoutSession(input:{orderId:string;buyerId:string;session:StripeCheckoutSession}){
 if(!getCreatedCheckoutSessionId(input.session)||!input.session.url||input.session.status!=="open"||input.session.payment_status!=="unpaid"||input.session.client_reference_id!==input.orderId||input.session.metadata?.order_id!==input.orderId){
  throw new Error("Checkout session is not ready.");
 }
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin.from("orders")
  .update({provider_checkout_session_id:input.session.id})
  .eq("id",input.orderId).eq("buyer_id",input.buyerId)
  .eq("payment_status","unpaid").is("provider_checkout_session_id",null)
  .select("id").maybeSingle();
 if(error||!data)throw new Error("Checkout session attachment was not confirmed.");
 return input.session.url;
}
