import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPaymentIntent,verifyStripeWebhookSignature } from "@/lib/stripe-payments";
import { closeProviderPaymentDispute } from "@/lib/commerce-provider-disputes";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";
export const runtime="nodejs";

type StripeEvent={
 id:string;
 type:string;
 data:{object:Record<string,unknown>};
};

const idValue=(value:unknown)=>{
 if(typeof value==="string")return value;
 if(value&&typeof value==="object"&&"id" in value&&typeof (value as {id?:unknown}).id==="string")return (value as {id:string}).id;
 return null;
};


const shippingSnapshot=(object:Record<string,unknown>)=>{
 const collected=object.collected_information;
 const collectedShipping=collected&&typeof collected==="object"&&!Array.isArray(collected)
  ?(collected as Record<string,unknown>).shipping_details
  :null;
 const legacyShipping=object.shipping_details;
 const shipping=(collectedShipping&&typeof collectedShipping==="object"&&!Array.isArray(collectedShipping))
  ?collectedShipping as Record<string,unknown>
  :(legacyShipping&&typeof legacyShipping==="object"&&!Array.isArray(legacyShipping))
   ?legacyShipping as Record<string,unknown>
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

const metadataOrderId=(object:Record<string,unknown>)=>{
 const metadata=object.metadata;
 if(metadata&&typeof metadata==="object"&&!Array.isArray(metadata)){
  const value=(metadata as Record<string,unknown>).order_id;
  if(typeof value==="string"&&isUuid(value))return value;
 }
 const reference=object.client_reference_id;
 return typeof reference==="string"&&isUuid(reference)?reference:null;
};

export async function POST(request:Request){
 const payload=await request.text();
 const signature=request.headers.get("stripe-signature");
 if(!verifyStripeWebhookSignature(payload,signature)){
  return NextResponse.json({received:false},{status:400});
 }

 let event:StripeEvent;
 try{event=JSON.parse(payload) as StripeEvent;}
 catch{return NextResponse.json({received:false},{status:400});}

 if(!event.id||!event.type||!event.data?.object){
  return NextResponse.json({received:false},{status:400});
 }

 const admin=createSupabaseAdminClient();
 const object=event.data.object;

 try{
  if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
   const orderId=metadataOrderId(object);
   const paymentStatus=typeof object.payment_status==="string"?object.payment_status:"";
   const sessionId=typeof object.id==="string"?object.id:"";
   const paymentIntentId=idValue(object.payment_intent);
   if(orderId&&sessionId&&paymentIntentId&&paymentStatus==="paid"){
    const paymentIntent=await getPaymentIntent(paymentIntentId);
    const chargeId=idValue(paymentIntent.latest_charge);
    if(!chargeId)throw new Error("Paid PaymentIntent did not contain a charge.");
    const shipping=shippingSnapshot(object);
    const {error}=await admin.rpc("confirm_checkout_paid",{
     p_order_id:orderId,
     p_event_id:event.id,
     p_checkout_session_id:sessionId,
     p_payment_intent_id:paymentIntentId,
     p_charge_id:chargeId,
     p_shipping_name:shipping.name??undefined,
     p_shipping_address:shipping.address??undefined
    });
    if(error)throw error;
   }
  }

  if(event.type==="checkout.session.expired"||event.type==="checkout.session.async_payment_failed"){
   const orderId=metadataOrderId(object);
   if(orderId){
    const {error}=await admin.rpc("cancel_checkout_order",{
     p_order_id:orderId,
     p_event_id:event.id,
     p_event_type:event.type
    });
    if(error)throw error;
   }
  }

  if(event.type==="payment_intent.payment_failed"){
   const orderId=metadataOrderId(object);
   if(orderId){
    const {error}=await admin.rpc("cancel_checkout_order",{
     p_order_id:orderId,
     p_event_id:event.id,
     p_event_type:event.type
    });
    if(error)throw error;
   }
  }

  if(event.type==="charge.dispute.created"){
   const disputeId=typeof object.id==="string"?object.id:"";
   const chargeId=idValue(object.charge);
   const status=typeof object.status==="string"?object.status:"unknown";
   const reason=typeof object.reason==="string"?object.reason:undefined;
   if(disputeId&&chargeId){
    const {error}=await admin.rpc("open_provider_payment_dispute",{
     p_event_id:event.id,
     p_dispute_id:disputeId,
     p_charge_id:chargeId,
     p_status:status,
     p_reason:reason
    });
    if(error)throw error;
   }
  }

  if(event.type==="charge.dispute.closed"){
   const disputeId=typeof object.id==="string"?object.id:"";
   const status=typeof object.status==="string"?object.status:"unknown";
   if(disputeId){
    await closeProviderPaymentDispute({
     eventId:event.id,
     disputeId,
     status
    });
   }
  }

  return NextResponse.json({received:true});
 }catch{
  return NextResponse.json({received:false},{status:500});
 }
}
