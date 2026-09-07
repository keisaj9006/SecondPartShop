"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCheckoutSession,isStripeCheckoutConfigured } from "@/lib/stripe-payments";
import { isUuid } from "@/lib/identifiers";
import type { ActionState,MarketplaceFilters } from "@/lib/types";
import { getPartCompatibility } from "@/lib/data/compatibility";
import { syncSellerPaymentAccount } from "@/lib/seller-payment-sync";

const knownMessage=(message:string)=>{
 const lower=message.toLowerCase();
 if(lower.includes("own listing"))return "You cannot buy your own listing.";
 if(lower.includes("not enough stock"))return "That quantity is no longer available.";
 if(lower.includes("not available for checkout"))return "This listing is no longer available.";
 if(lower.includes("collection is not available"))return "Collection is not available for this listing.";
 if(lower.includes("not ready to receive"))return "This seller is still completing marketplace payout setup.";
 if(lower.includes("active checkout reservation for this part"))return "You already have an active checkout for this part. Open Purchases to continue or wait for it to expire.";
 if(lower.includes("too many active checkout reservations"))return "You already have several active checkouts. Complete or cancel one before reserving another part.";
 if(lower.includes("vehicle")||lower.includes("engine/fuel")||lower.includes("registration"))return "We could not verify the selected vehicle for this checkout. Re-select the vehicle and try again.";
 return "Checkout could not be started. Please try again.";
};

export async function startCheckout(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const partId=String(formData.get("partId")??"");
 const quantity=Math.floor(Number(formData.get("quantity")??1));
 const deliveryMethod=String(formData.get("deliveryMethod")??"shipping");
 const vehicleVariantId=String(formData.get("vehicleVariantId")??"").trim();
 const vehicleYearText=String(formData.get("vehicleYear")??"").trim();
 const vehicleFuel=String(formData.get("vehicleFuel")??"").trim();
 const vehicleEngineText=String(formData.get("vehicleEngine")??"").trim();
 const vehicleRegistration=String(formData.get("vehicleRegistration")??"").trim();
 const compatibilityAcknowledged=String(formData.get("compatibilityAcknowledged")??"")==="1";
 const vehicleYear=vehicleYearText?Number(vehicleYearText):undefined;
 const vehicleEngine=vehicleEngineText?Number(vehicleEngineText):undefined;
 if(!isUuid(partId))return {status:"error",message:"This listing could not be identified."};
 if(!Number.isInteger(quantity)||quantity<1||quantity>10)return {status:"error",message:"Choose a valid quantity."};
 if(!(["shipping","collection"] as string[]).includes(deliveryMethod))return {status:"error",message:"Choose shipping or collection."};
 if(vehicleVariantId&&(!isUuid(vehicleVariantId)||!Number.isInteger(vehicleYear)))return {status:"error",message:"Re-select your vehicle before checkout."};
 if(vehicleEngineText&&!Number.isInteger(vehicleEngine))return {status:"error",message:"The selected vehicle engine is invalid."};
 if(!isStripeCheckoutConfigured())return {status:"error",message:"Marketplace checkout is not enabled yet."};

 const user=await requireUser("/account");
 const supabase=await createSupabaseServerClient();

 const {data:part}=await supabase.from("parts").select("slug,seller_id").eq("id",partId).maybeSingle();
 if(!part)return {status:"error",message:"This listing is no longer available."};

 try{
  const paymentStatus=await syncSellerPaymentAccount(part.seller_id);
  if(!paymentStatus.active)return {status:"error",message:"This seller is still completing marketplace payout setup."};
 }catch{
  return {status:"error",message:"We could not verify the seller payout account right now. Please try again."};
 }

 if(vehicleVariantId&&vehicleYear!==undefined){
  const filters:MarketplaceFilters={
   catalogueVariant:vehicleVariantId,
   catalogueYear:vehicleYear,
   catalogueFuel:vehicleFuel||undefined,
   catalogueEngineSize:vehicleEngine
  };
  const compatibility=await getPartCompatibility(partId,filters).catch(()=>null);
  if(compatibility&&(compatibility.level==="family_match"||compatibility.level==="unverified")&&!compatibilityAcknowledged){
   return {status:"error",message:"Compatibility with your selected vehicle is not confirmed. Please acknowledge the compatibility warning before checkout."};
  }
 }

 const {data,error}=await supabase.rpc("prepare_checkout_order_v2",{
  p_part_id:partId,
  p_quantity:quantity,
  p_delivery_method:deliveryMethod,
  p_vehicle_variant_id:vehicleVariantId||undefined,
  p_vehicle_year:vehicleYear,
  p_vehicle_fuel:vehicleFuel||undefined,
  p_vehicle_engine:vehicleEngine,
  p_vehicle_registration:vehicleRegistration||undefined
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
