import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reconcileStripeOrder } from "@/lib/commerce-reconciliation";
import { getAppUrl } from "@/lib/stripe-connect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:Request){
 const url=new URL(request.url);
 const orderId=url.searchParams.get("order")??"";
 const sessionId=url.searchParams.get("session_id")??"";
 const appUrl=getAppUrl();

 if(!isUuid(orderId)||!sessionId.startsWith("cs_")){
  return NextResponse.redirect(new URL("/account/orders?checkout=invalid",appUrl));
 }

 const user=await getCurrentUser();
 if(!user){
  return NextResponse.redirect(new URL("/account?returnTo="+encodeURIComponent("/account/orders/"+orderId),appUrl));
 }

 const supabase=await createSupabaseServerClient();
 const {data:order}=await supabase
  .from("orders")
  .select("id,provider_checkout_session_id")
  .eq("id",orderId)
  .eq("buyer_id",user.id)
  .maybeSingle();

 if(!order||order.provider_checkout_session_id!==sessionId){
  return NextResponse.redirect(new URL("/account/orders?checkout=invalid",appUrl));
 }

 const result=await reconcileStripeOrder(orderId,sessionId);
 const state=result.state==="paid"||result.state==="already_settled"?"success":"pending";
 return NextResponse.redirect(new URL("/account/orders/"+orderId+"?checkout="+state,appUrl));
}
