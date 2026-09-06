import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCheckoutSession,getPaymentIntent,isStripeCheckoutConfigured } from "@/lib/stripe-payments";

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
  const sessionId=order.provider_checkout_session_id;
  if(!sessionId){deferred+=1;continue;}

  try{
   const session=await getCheckoutSession(sessionId);

   if(session.payment_status==="paid"){
    const paymentIntentId=idValue(session.payment_intent);
    if(!paymentIntentId){deferred+=1;continue;}
    const paymentIntent=await getPaymentIntent(paymentIntentId);
    const chargeId=idValue(paymentIntent.latest_charge);
    if(!chargeId){deferred+=1;continue;}
    const shipping=shippingSnapshot(session);
    const {error:confirmError}=await admin.rpc("confirm_checkout_paid",{
     p_order_id:order.id,
     p_event_id:"reconcile-paid:"+session.id,
     p_checkout_session_id:session.id,
     p_payment_intent_id:paymentIntentId,
     p_charge_id:chargeId,
     p_shipping_name:shipping.name??undefined,
     p_shipping_address:shipping.address??undefined
    });
    if(confirmError)throw confirmError;
    repairedPaid+=1;
    continue;
   }

   if(session.status==="expired"){
    const {error:cancelError}=await admin.rpc("cancel_checkout_order",{
     p_order_id:order.id,
     p_event_id:"reconcile-expired:"+session.id,
     p_event_type:"reconciliation_checkout_expired"
    });
    if(cancelError)throw cancelError;
    repairedExpired+=1;
    continue;
   }

   deferred+=1;
  }catch{
   deferred+=1;
  }
 }

 return {checked:data?.length??0,repairedPaid,repairedExpired,deferred,skipped:false};
}
