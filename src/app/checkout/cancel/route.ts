import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/stripe-connect";
import { cancelCheckoutOrder } from "@/lib/checkout-lifecycle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const listingSlug=(value:unknown)=>{
 const row=Array.isArray(value)?value[0]:value;
 if(!row||typeof row!=="object"||!("slug" in row))return null;
 const slug=(row as {slug?:unknown}).slug;
 return typeof slug==="string"?slug:null;
};

export async function GET(request:Request){
 const url=new URL(request.url);
 const orderId=url.searchParams.get("order")??"";
 const appUrl=getAppUrl();
 const requestedReturnTo=url.searchParams.get("returnTo")??"";
 if(!isUuid(orderId))return NextResponse.redirect(new URL("/account/orders?checkout=invalid",appUrl));

 const user=await getCurrentUser();
 if(!user){
  return NextResponse.redirect(new URL("/account?returnTo="+encodeURIComponent("/account/orders/"+orderId),appUrl));
 }

 const supabase=await createSupabaseServerClient();
 const {data:order}=await supabase
  .from("orders")
  .select("id,payment_status")
  .eq("id",orderId)
  .eq("buyer_id",user.id)
  .maybeSingle();

 if(!order)return NextResponse.redirect(new URL("/account/orders?checkout=invalid",appUrl));

 const {data:item}=await supabase
  .from("order_items")
  .select("parts(slug)")
  .eq("order_id",orderId)
  .limit(1)
  .maybeSingle();
 const slug=listingSlug(item?.parts);

 const cancellation=await cancelCheckoutOrder({orderId,buyerId:user.id,eventType:"buyer_cancelled_checkout"});
 if(cancellation!=="cancelled"){
  return NextResponse.redirect(new URL("/account/orders/"+orderId+"?checkout="+(cancellation==="unavailable"?"cancel_pending":"not_cancellable"),appUrl));
 }

 let targetUrl:URL;
 if(slug){
  const fallback="/parts/"+encodeURIComponent(slug);
  try{
   const app=new URL(appUrl);
   const requested=new URL(requestedReturnTo||fallback,app);
   targetUrl=requested.origin===app.origin&&requested.pathname===fallback?requested:new URL(fallback,app);
  }catch{
   targetUrl=new URL(fallback,appUrl);
  }
  targetUrl.searchParams.set("checkout","cancelled");
 }else{
  targetUrl=new URL("/account/orders?checkout=cancelled",appUrl);
 }
 return NextResponse.redirect(targetUrl);
}
