"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCheckoutSession,isStripeCheckoutConfigured } from "@/lib/stripe-payments";
import { isUuid } from "@/lib/identifiers";
import type { ActionState } from "@/lib/types";

const knownMessage=(message:string)=>{
 const lower=message.toLowerCase();
 if(lower.includes("own listing"))return "You cannot buy your own listing.";
 if(lower.includes("not enough stock"))return "That quantity is no longer available.";
 if(lower.includes("not available for checkout"))return "This listing is no longer available.";
 if(lower.includes("collection is not available"))return "Collection is not available for this listing.";
 if(lower.includes("not ready to receive"))return "This seller is still completing marketplace payout setup.";
 if(lower.includes("active checkout reservation for this part"))return "You already have an active checkout for this part. Open Purchases to continue or wait for it to expire.";
 if(lower.includes("too many active checkout reservations"))return "You already have several active checkouts. Complete or cancel one before reserving another part.";
 return "Checkout could not be started. Please try again.";
};

export async function startCheckout(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const partId=String(formData.get("partId")??"");
 const quantity=Math.floor(Number(formData.get("quantity")??1));
 const deliveryMethod=String(formData.get("deliveryMethod")??"shipping");
 if(!isUuid(partId))return {status:"error",message:"This listing could not be identified."};
 if(!Number.isInteger(quantity)||quantity<1||quantity>10)return {status:"error",message:"Choose a valid quantity."};
 if(!(["shipping","collection"] as string[]).includes(deliveryMethod))return {status:"error",message:"Choose shipping or collection."};
 if(!isStripeCheckoutConfigured())return {status:"error",message:"Marketplace checkout is not enabled yet."};

 const user=await requireUser("/account");
 const supabase=await createSupabaseServerClient();

 const {data:part}=await supabase.from("parts").select("slug").eq("id",partId).maybeSingle();
 if(!part)return {status:"error",message:"This listing is no longer available."};

 const {data,error}=await supabase.rpc("prepare_checkout_order",{
  p_part_id:partId,
  p_quantity:quantity,
  p_delivery_method:deliveryMethod
 });
 const reservation=data?.[0];
 if(error||!reservation)return {status:"error",message:knownMessage(error?.message??"")};

 let checkoutUrl:string|null=null;
 try{
  const session=await createCheckoutSession({
   orderId:reservation.order_id,
   partTitle:reservation.part_title,
   partSlug:part.slug,
   quantity:reservation.quantity,
   unitPricePence:reservation.unit_price_pence,
   shippingPence:reservation.shipping_pence,
   deliveryMethod:deliveryMethod as "shipping"|"collection",
   customerEmail:user.email,
   expiresAt:reservation.checkout_expires_at
  });

  const admin=createSupabaseAdminClient();
  const {error:updateError}=await admin
   .from("orders")
   .update({provider_checkout_session_id:session.id})
   .eq("id",reservation.order_id)
   .eq("payment_status","unpaid");
  if(updateError)throw updateError;
  checkoutUrl=session.url;
 }catch{
  const admin=createSupabaseAdminClient();
  await admin.rpc("cancel_checkout_order",{
   p_order_id:reservation.order_id,
   p_event_type:"checkout_setup_failed"
  });
  return {status:"error",message:"Checkout is temporarily unavailable. Your reserved stock has been released."};
 }

 if(!checkoutUrl)return {status:"error",message:"Stripe did not return a checkout page."};
 redirect(checkoutUrl);
}
