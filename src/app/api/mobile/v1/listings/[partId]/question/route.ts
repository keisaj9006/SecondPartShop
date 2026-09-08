import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { isUuid } from "@/lib/identifiers";
import { schedulePushDispatch } from "@/lib/push/schedule";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function POST(request:Request,{params}:{params:Promise<{partId:string}>}){
 const {partId}=await params;
 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const body=typeof payload==="object"&&payload!==null&&"body" in payload?String((payload as {body?:unknown}).body??"").trim():"";
 if(body.length<2)return mobileJson(request,{ok:false,error:"message_required"},400);
 if(body.length>2000)return mobileJson(request,{ok:false,error:"message_too_long"},400);

 const {data,error}=await supabase.rpc("start_listing_conversation",{p_part_id:partId,p_body:body});
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("rate limit")||lower.includes("conversation limit"))return mobileJson(request,{ok:false,error:"rate_limited"},429);
  if(lower.includes("own listing"))return mobileJson(request,{ok:false,error:"own_listing"},400);
  if(lower.includes("unavailable"))return mobileJson(request,{ok:false,error:"listing_unavailable"},409);
  return mobileJson(request,{ok:false,error:"conversation_failed"},400);
 }

 schedulePushDispatch(50);
 return mobileJson(request,{ok:true,conversationId:data},201);
}
