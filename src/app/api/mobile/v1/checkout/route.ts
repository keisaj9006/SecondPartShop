import { createCheckoutSession,isStripeCheckoutConfigured } from "@/lib/stripe-payments";
import { getAppUrl } from "@/lib/stripe-connect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { getPartCompatibility } from "@/lib/data/compatibility";
import type { MarketplaceFilters } from "@/lib/types";
import { syncSellerPaymentAccount } from "@/lib/seller-payment-sync";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const knownError=(message:string)=>{
 const lower=message.toLowerCase();
 if(lower.includes("own listing"))return "own_listing";
 if(lower.includes("not enough stock"))return "stock_unavailable";
 if(lower.includes("not available for checkout"))return "listing_unavailable";
 if(lower.includes("collection is not available"))return "collection_unavailable";
 if(lower.includes("not ready to receive"))return "seller_payout_setup_required";
 if(lower.includes("active checkout reservation for this part"))return "duplicate_reservation";
 if(lower.includes("too many active checkout reservations"))return "reservation_limit";
 if(lower.includes("vehicle")||lower.includes("engine/fuel")||lower.includes("registration"))return "invalid_vehicle_context";
 return "checkout_unavailable";
};

export async function POST(request:Request){
 if(!isStripeCheckoutConfigured())return mobileJson(request,{ok:false,error:"checkout_not_configured"},503);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const partId=String(input.partId??"");
 const quantity=Math.floor(Number(input.quantity??1));
 const deliveryMethod=String(input.deliveryMethod??"shipping");
 const vehicle=input.vehicle&&typeof input.vehicle==="object"?input.vehicle as Record<string,unknown>:{};
 const vehicleVariantId=String(vehicle.variantId??input.vehicleVariantId??"").trim();
 const vehicleYearRaw=vehicle.year??input.vehicleYear;
 const vehicleYear=vehicleYearRaw===undefined||vehicleYearRaw===null||vehicleYearRaw===""?undefined:Number(vehicleYearRaw);
 const vehicleFuel=String(vehicle.fuel??input.vehicleFuel??"").trim();
 const vehicleEngineRaw=vehicle.engine??input.vehicleEngine;
 const vehicleEngine=vehicleEngineRaw===undefined||vehicleEngineRaw===null||vehicleEngineRaw===""?undefined:Number(vehicleEngineRaw);
 const vehicleRegistration=String(vehicle.registration??input.vehicleRegistration??"").trim();
 const compatibilityAcknowledged=input.compatibilityAcknowledged===true||String(input.compatibilityAcknowledged??"")==="1";

 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);
 if(!Number.isInteger(quantity)||quantity<1||quantity>10)return mobileJson(request,{ok:false,error:"invalid_quantity"},400);
 if(!["shipping","collection"].includes(deliveryMethod))return mobileJson(request,{ok:false,error:"invalid_delivery_method"},400);
 if(vehicleVariantId&&(!isUuid(vehicleVariantId)||!Number.isInteger(vehicleYear)))return mobileJson(request,{ok:false,error:"invalid_vehicle_context"},400);
 if(vehicleEngine!==undefined&&!Number.isInteger(vehicleEngine))return mobileJson(request,{ok:false,error:"invalid_vehicle_context"},400);

 const {data:part}=await supabase.from("parts").select("slug,seller_id").eq("id",partId).maybeSingle();
 if(!part)return mobileJson(request,{ok:false,error:"listing_unavailable"},404);

 try{
  const paymentStatus=await syncSellerPaymentAccount(part.seller_id);
  if(!paymentStatus.active)return mobileJson(request,{ok:false,error:"seller_payout_setup_required"},409);
 }catch{
  return mobileJson(request,{ok:false,error:"seller_payment_status_unavailable"},503);
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
   return mobileJson(request,{ok:false,error:"compatibility_acknowledgement_required",compatibility},409);
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
 if(error||!reservation)return mobileJson(request,{ok:false,error:knownError(error?.message??"")},409);

 try{
  const appUrl=getAppUrl();
  const session=await createCheckoutSession({
   orderId:reservation.order_id,
   partTitle:reservation.part_title,
   partSlug:part.slug,
   quantity:reservation.quantity,
   unitPricePence:reservation.unit_price_pence,
   shippingPence:reservation.shipping_pence,
   deliveryMethod:deliveryMethod as "shipping"|"collection",
   customerEmail:user.email,
   expiresAt:reservation.checkout_expires_at,
   successUrl:appUrl+"/checkout/mobile-complete?state=success&order="+encodeURIComponent(reservation.order_id),
   cancelUrl:appUrl+"/checkout/mobile-complete?state=cancelled&order="+encodeURIComponent(reservation.order_id)
  });

  const admin=createSupabaseAdminClient();
  const {error:updateError}=await admin
   .from("orders")
   .update({provider_checkout_session_id:session.id})
   .eq("id",reservation.order_id)
   .eq("buyer_id",user.id)
   .eq("payment_status","unpaid");
  if(updateError)throw updateError;
  if(!session.url)throw new Error("Stripe checkout URL missing.");

  return mobileJson(request,{
   ok:true,
   orderId:reservation.order_id,
   checkoutUrl:session.url,
   expiresAt:reservation.checkout_expires_at
  },201);
 }catch{
  const admin=createSupabaseAdminClient();
  await admin.rpc("cancel_checkout_order",{
   p_order_id:reservation.order_id,
   p_event_type:"mobile_checkout_setup_failed"
  });
  return mobileJson(request,{ok:false,error:"checkout_provider_unavailable"},503);
 }
}
