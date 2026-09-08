import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { schedulePushDispatch } from "@/lib/push/schedule";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function PATCH(request:Request,{params}:{params:Promise<{requestId:string}>}){
 const {requestId}=await params;
 if(!isUuid(requestId))return mobileJson(request,{ok:false,error:"invalid_fitting_request"},400);
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 const action=String(input.action??"");
 if(!["accept","cancel"].includes(action))return mobileJson(request,{ok:false,error:"invalid_fitting_action"},400);
 const {error}=await auth.context.supabase.rpc("buyer_respond_fitting_quote",{p_request_id:requestId,p_action:action});
 if(error)return mobileJson(request,{ok:false,error:"fitting_update_failed"},409);
 schedulePushDispatch(50);
 return mobileJson(request,{ok:true,status:action==="accept"?"accepted":"cancelled"});
}
