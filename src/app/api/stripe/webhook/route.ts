import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPaymentIntent,verifyStripeWebhookSignature } from "@/lib/stripe-payments";
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
    const {error}=await admin.rpc("confirm_checkout_paid",{
     p_order_id:orderId,
     p_event_id:event.id,
     p_checkout_session_id:sessionId,
     p_payment_intent_id:paymentIntentId,
     p_charge_id:chargeId
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
    const {error}=await admin.rpc("close_provider_payment_dispute",{
     p_event_id:event.id,
     p_dispute_id:disputeId,
     p_status:status
    });
    if(error)throw error;
   }
  }

  return NextResponse.json({received:true});
 }catch{
  return NextResponse.json({received:false},{status:500});
 }
}
