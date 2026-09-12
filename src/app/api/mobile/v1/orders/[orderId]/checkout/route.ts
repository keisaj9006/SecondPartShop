import { cancelCheckoutOrder } from "@/lib/checkout-lifecycle";
import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function DELETE(request:Request,{params}:{params:Promise<{orderId:string}>}){
 const {orderId}=await params;
 if(!isUuid(orderId))return mobileJson(request,{ok:false,error:"invalid_order"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const {data:order,error}=await supabase
  .from("orders")
  .select("id,payment_status")
  .eq("id",orderId)
  .eq("buyer_id",user.id)
  .maybeSingle();
 if(error)return mobileJson(request,{ok:false,error:"order_unavailable"},503);
 if(!order)return mobileJson(request,{ok:false,error:"not_found"},404);
 const cancellation=await cancelCheckoutOrder({orderId,buyerId:user.id,eventType:"mobile_buyer_cancelled_checkout"});
 if(cancellation==="unavailable"){
  return mobileJson(request,{ok:false,error:"cancel_failed"},503);
 }
 if(cancellation!=="cancelled")return mobileJson(request,{ok:false,error:"checkout_not_cancellable"},409);

 return mobileJson(request,{ok:true,cancelled:true});
}
