"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { reconcileStripeOrder } from "@/lib/commerce-reconciliation";
import { getCheckoutSession } from "@/lib/stripe-payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";

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

 const sessionId=order.provider_checkout_session_id;
 if(!sessionId)redirect("/account/orders/"+orderId+"?checkout=unavailable");

 try{
  const session=await getCheckoutSession(sessionId);
  if(session.payment_status==="paid"){
   await reconcileStripeOrder(orderId,sessionId);
   redirect("/account/orders/"+orderId+"?checkout=success");
  }
  if(session.status==="open"&&session.url)redirect(session.url);
  if(session.status==="expired"){
   const admin=createSupabaseAdminClient();
   await admin.rpc("cancel_checkout_order",{
    p_order_id:orderId,
    p_event_id:"resume-expired:"+sessionId,
    p_event_type:"resume_checkout_expired"
   });
   redirect("/account/orders/"+orderId+"?checkout=expired");
  }
 }catch{
  redirect("/account/orders/"+orderId+"?checkout=unavailable");
 }

 redirect("/account/orders/"+orderId+"?checkout=pending");
}
