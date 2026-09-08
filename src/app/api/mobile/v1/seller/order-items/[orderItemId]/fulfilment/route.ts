import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { schedulePushDispatch } from "@/lib/push/schedule";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function POST(request:Request,{params}:{params:Promise<{orderItemId:string}>}){
 const {orderItemId}=await params;
 if(!isUuid(orderItemId))return mobileJson(request,{ok:false,error:"invalid_order_item"},400);

 const auth=await requireMobileSeller(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
 const action=String(input.action??"");
 const carrier=String(input.carrier??"").trim();
 const tracking=String(input.trackingNumber??"").trim();

 if(!["preparing","dispatch","ready_for_collection"].includes(action)){
  return mobileJson(request,{ok:false,error:"invalid_fulfilment_action"},400);
 }

 const {error}=await supabase.rpc("seller_set_order_item_fulfilment",{
  p_order_item_id:orderItemId,
  p_action:action,
  p_carrier:carrier||undefined,
  p_tracking_number:tracking||undefined
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("tracking"))return mobileJson(request,{ok:false,error:"tracking_required"},400);
  if(lower.includes("not been paid"))return mobileJson(request,{ok:false,error:"order_not_paid"},409);
  if(lower.includes("seller"))return mobileJson(request,{ok:false,error:"forbidden"},403);
  return mobileJson(request,{ok:false,error:"fulfilment_update_failed"},409);
 }

 schedulePushDispatch(50);
 return mobileJson(request,{ok:true,state:action==="dispatch"?"dispatched":action});
}
