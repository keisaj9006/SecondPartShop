import { releaseDuePayoutItem } from "@/lib/commerce-payouts";
import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function POST(request:Request,{params}:{params:Promise<{orderItemId:string}>}){
 const {orderItemId}=await params;
 if(!isUuid(orderItemId))return mobileJson(request,{ok:false,error:"invalid_order_item"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const acceptNow=Boolean(payload&&typeof payload==="object"&&"acceptNow" in payload&&(payload as {acceptNow?:unknown}).acceptNow===true);

 const {error}=await supabase.rpc("buyer_mark_order_item_received",{
  p_order_item_id:orderItemId,
  p_accept_now:acceptNow
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("buyer")||lower.includes("purchase"))return mobileJson(request,{ok:false,error:"forbidden"},403);
  return mobileJson(request,{ok:false,error:"receipt_update_failed"},409);
 }

 let payoutReleased=false;
 if(acceptNow){
  try{
   const result=await releaseDuePayoutItem(orderItemId);
   payoutReleased=result.released;
  }catch{
   payoutReleased=false;
  }
 }

 return mobileJson(request,{
  ok:true,
  accepted:acceptNow,
  payoutReleased,
  state:acceptNow?"accepted":"received"
 });
}
