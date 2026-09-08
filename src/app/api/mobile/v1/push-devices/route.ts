import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {mobileJson,mobileOptions,requireMobileUser} from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export function OPTIONS(request:Request){return mobileOptions(request);}

const inputFrom=async(request:Request)=>{
 let payload:unknown;
 try{payload=await request.json();}catch{return null;}
 return payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:null;
};

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const admin=createSupabaseAdminClient();
 const {count,error}=await admin.from("mobile_push_devices")
  .select("id",{count:"exact",head:true})
  .eq("profile_id",auth.context.user.id)
  .eq("enabled",true);
 if(error)return mobileJson(request,{ok:false,error:"push_status_unavailable"},503);
 return mobileJson(request,{ok:true,registered:(count??0)>0,count:count??0});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const input=await inputFrom(request);
 if(!input)return mobileJson(request,{ok:false,error:"invalid_json"},400);
 const token=String(input.token??"").trim();
 const platform=String(input.platform??"android");
 const appId=String(input.appId??"").trim();
 const buildChannel=String(input.buildChannel??"preview");
 if(token.length<20||token.length>4096)return mobileJson(request,{ok:false,error:"invalid_push_token"},400);
 if(!["android","ios"].includes(platform))return mobileJson(request,{ok:false,error:"invalid_push_platform"},400);
 if(!["preview","release"].includes(buildChannel))return mobileJson(request,{ok:false,error:"invalid_build_channel"},400);
 if(appId.length<3||appId.length>160)return mobileJson(request,{ok:false,error:"invalid_app_id"},400);

 const admin=createSupabaseAdminClient();
 const now=new Date().toISOString();
 const {error}=await admin.from("mobile_push_devices").upsert({
  profile_id:auth.context.user.id,
  provider:"fcm",
  platform,
  token,
  app_id:appId,
  build_channel:buildChannel,
  enabled:true,
  last_seen_at:now,
  updated_at:now
 },{onConflict:"provider,token"});
 if(error)return mobileJson(request,{ok:false,error:"push_registration_failed"},503);
 return mobileJson(request,{ok:true,registered:true});
}

export async function DELETE(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const input=await inputFrom(request);
 if(!input)return mobileJson(request,{ok:false,error:"invalid_json"},400);
 const token=String(input.token??"").trim();
 if(token.length<20||token.length>4096)return mobileJson(request,{ok:false,error:"invalid_push_token"},400);
 const admin=createSupabaseAdminClient();
 const {error}=await admin.from("mobile_push_devices")
  .update({enabled:false,updated_at:new Date().toISOString()})
  .eq("profile_id",auth.context.user.id)
  .eq("provider","fcm")
  .eq("token",token);
 if(error)return mobileJson(request,{ok:false,error:"push_unregister_failed"},503);
 return mobileJson(request,{ok:true,registered:false});
}
