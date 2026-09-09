"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { reconcileStripeOrder } from "@/lib/commerce-reconciliation";
import { getCheckoutSession } from "@/lib/stripe-payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";
import { schedulePushDispatch } from "@/lib/push/schedule";
import { reportOperationalError } from "@/lib/ops-monitoring";

export async function resumeCheckout(formData:FormData){
 const orderId=String(formData.get("orderId")??"");
 if(!isUuid(orderId))redirect("/account/orders?checkout=invalid");

 const user=await requireUser("/account/orders");
 const supabase=await createSupabaseServerClient();
 const {data:order}=await supabase
  .from("orders")
  .select("id,payment_status,provider_checkout_session_id")
  .eq("id",orderId)
  .eq("buyer_id",user.id)
  .maybeSingle();

 if(!order)redirect("/account/orders?checkout=invalid");
 if(order.payment_status==="paid"||order.payment_status==="partially_refunded"||order.payment_status==="refunded"){
  redirect("/account/orders/"+orderId);
 }
 if(order.payment_status==="processing")redirect("/account/orders/"+orderId+"?checkout=pending");

 const sessionId=order.provider_checkout_session_id;
 if(!sessionId)redirect("/account/orders/"+orderId+"?checkout=unavailable");

 let target="/account/orders/"+orderId+"?checkout=pending";
 try{
  const session=await getCheckoutSession(sessionId);

  if(session.payment_status==="paid"){
   await reconcileStripeOrder(orderId,sessionId);
   target="/account/orders/"+orderId+"?checkout=success";
  }else if(session.status==="open"&&session.url){
   target=session.url;
  }else if(session.status==="expired"){
   const admin=createSupabaseAdminClient();
   await admin.rpc("cancel_checkout_order",{
    p_order_id:orderId,
    p_event_id:"resume-expired:"+sessionId,
    p_event_type:"resume_checkout_expired"
   });
   target="/account/orders/"+orderId+"?checkout=expired";
  }
 }catch(error){
  await reportOperationalError({component:"checkout",event:"resume_checkout_failed",error});
  target="/account/orders/"+orderId+"?checkout=unavailable";
 }

 schedulePushDispatch(50);
 redirect(target);
}
