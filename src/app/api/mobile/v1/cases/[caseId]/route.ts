import {isUuid} from "@/lib/identifiers";
import {mobileJson,mobileOptions,requireMobileUser} from "@/lib/mobile-api";
import { schedulePushDispatch } from "@/lib/push/schedule";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function POST(request:Request,{params}:{params:Promise<{caseId:string}>}){
 const {caseId}=await params;
 if(!isUuid(caseId))return mobileJson(request,{ok:false,error:"invalid_case"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 const action=String(input.action??"");

 if(action!=="mark_return_shipped")return mobileJson(request,{ok:false,error:"invalid_case_action"},400);

 const carrier=String(input.carrier??"").trim();
 const trackingNumber=String(input.trackingNumber??"").trim();
 if(trackingNumber.length<3)return mobileJson(request,{ok:false,error:"tracking_required"},400);
 if(trackingNumber.length>160)return mobileJson(request,{ok:false,error:"tracking_too_long"},400);
 if(carrier.length>80)return mobileJson(request,{ok:false,error:"carrier_too_long"},400);

 const {error}=await supabase.rpc("buyer_mark_transaction_return_shipped",{
  p_case_id:caseId,
  p_carrier:carrier,
  p_tracking_number:trackingNumber
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("buyer")||lower.includes("purchase")||lower.includes("case not found"))return mobileJson(request,{ok:false,error:"forbidden"},403);
  if(lower.includes("authorized"))return mobileJson(request,{ok:false,error:"return_not_authorized"},409);
  if(lower.includes("tracking"))return mobileJson(request,{ok:false,error:"tracking_required"},400);
  return mobileJson(request,{ok:false,error:"return_shipment_update_failed"},409);
 }

 schedulePushDispatch(50);
 return mobileJson(request,{ok:true,state:"return_shipped"});
}
