import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCheckoutSession,getPaymentIntent,isStripeCheckoutConfigured } from "@/lib/stripe-payments";
import { reportOperationalWarning } from "@/lib/ops-monitoring";

type PendingOrder={
 id:string;
 payment_status:string;
 provider_checkout_session_id:string|null;
 checkout_expires_at:string|null;
 created_at:string;
};

const idValue=(value:unknown)=>{
 if(typeof value==="string")return value;
 if(value&&typeof value==="object"&&"id" in value&&typeof (value as {id?:unknown}).id==="string")return (value as {id:string}).id;
 return null;
};

const shippingSnapshot=(session:{collected_information?:Record<string,unknown>|null;shipping_details?:Record<string,unknown>|null})=>{
 const collected=session.collected_information;
 const nested=collected&&typeof collected==="object"&&!Array.isArray(collected)
  ?(collected as Record<string,unknown>).shipping_details
  :null;
 const shipping=(nested&&typeof nested==="object"&&!Array.isArray(nested))
  ?nested as Record<string,unknown>
  :(session.shipping_details&&typeof session.shipping_details==="object"&&!Array.isArray(session.shipping_details))
   ?session.shipping_details
   :null;
 if(!shipping)return {name:null,address:null};
 const name=typeof shipping.name==="string"?shipping.name.slice(0,160):null;
 const rawAddress=shipping.address;
 if(!rawAddress||typeof rawAddress!=="object"||Array.isArray(rawAddress))return {name,address:null};
 const source=rawAddress as Record<string,unknown>;
 const clean=(key:string,max=160)=>typeof source[key]==="string"?(source[key] as string).slice(0,max):null;
 return {
  name,
  address:{
   line1:clean("line1"),
   line2:clean("line2"),
   city:clean("city"),
   state:clean("state"),
   postal_code:clean("postal_code",30),
   country:clean("country",2)
  }
 };
};

async function reconcileOrderRow(admin:ReturnType<typeof createSupabaseAdminClient>,order:PendingOrder){
 const sessionId=order.provider_checkout_session_id;
 if(!sessionId)return {state:"deferred" as const,sessionId:null};

 const session=await getCheckoutSession(sessionId);

 if(session.payment_status==="paid"){
  const paymentIntentId=idValue(session.payment_intent);
  if(!paymentIntentId)return {state:"deferred" as const,sessionId};
  const paymentIntent=await getPaymentIntent(paymentIntentId);
  const chargeId=idValue(paymentIntent.latest_charge);
  if(!chargeId)return {state:"deferred" as const,sessionId};
  const shipping=shippingSnapshot(session);
  const {error}=await admin.rpc("confirm_checkout_paid",{
   p_order_id:order.id,
   p_event_id:"reconcile-paid:"+session.id,
   p_checkout_session_id:session.id,
   p_payment_intent_id:paymentIntentId,
   p_charge_id:chargeId,
   p_shipping_name:shipping.name??undefined,
   p_shipping_address:shipping.address??undefined
  });
  if(error)throw error;
  return {state:"paid" as const,sessionId};
 }

 if(session.status==="expired"){
  const {error}=await admin.rpc("cancel_checkout_order",{
   p_order_id:order.id,
   p_event_id:"reconcile-expired:"+session.id,
   p_event_type:"reconciliation_checkout_expired"
  });
  if(error)throw error;
  return {state:"expired" as const,sessionId};
 }

 return {state:"deferred" as const,sessionId};
}

export async function reconcileStripeOrder(orderId:string,expectedSessionId?:string){
 if(!isStripeCheckoutConfigured())return {state:"skipped" as const};

 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("orders")
  .select("id,payment_status,provider_checkout_session_id,checkout_expires_at,created_at")
  .eq("id",orderId)
  .maybeSingle();
 if(error)throw error;
 if(!data)return {state:"missing" as const};
 if(expectedSessionId&&data.provider_checkout_session_id!==expectedSessionId)return {state:"session_mismatch" as const};
 if(!["unpaid","requires_action","processing"].includes(data.payment_status))return {state:"already_settled" as const};

 try{
  return await reconcileOrderRow(admin,data as PendingOrder);
 }catch(error){
  reportOperationalWarning({
   component:"reconciliation",
   event:"single_order_reconciliation_failed",
   message:error instanceof Error?error.message:"Stripe reconciliation failed."
  });
  return {state:"deferred" as const};
 }
}

export async function reconcileStripeOrders(limit=100){
 if(!isStripeCheckoutConfigured())return {checked:0,repairedPaid:0,repairedExpired:0,deferred:0,skipped:true};

 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("orders")
  .select("id,payment_status,provider_checkout_session_id,checkout_expires_at,created_at")
  .eq("payment_provider","stripe")
  .in("payment_status",["unpaid","requires_action","processing"])
  .not("provider_checkout_session_id","is",null)
  .order("created_at",{ascending:true})
  .limit(Math.max(1,Math.min(limit,500)));
 if(error)throw error;

 let repairedPaid=0;
 let repairedExpired=0;
 let deferred=0;

 for(const order of data??[]){
  try{
   const result=await reconcileOrderRow(admin,order as PendingOrder);
   if(result.state==="paid")repairedPaid+=1;
   else if(result.state==="expired")repairedExpired+=1;
   else deferred+=1;
  }catch(error){
   deferred+=1;
   reportOperationalWarning({
    component:"reconciliation",
    event:"batch_order_reconciliation_failed",
    message:error instanceof Error?error.message:"Stripe reconciliation failed."
   });
  }
 }

 return {checked:data?.length??0,repairedPaid,repairedExpired,deferred,skipped:false};
}
