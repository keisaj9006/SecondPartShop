import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const {data,error}=await supabase
  .from("account_deletion_requests")
  .select("id,status,reason,requested_at,updated_at")
  .eq("profile_id",user.id)
  .eq("status","requested")
  .maybeSingle();

 if(error)return mobileJson(request,{ok:false,error:"account_security_unavailable"},503);

 return mobileJson(request,{
  ok:true,
  email:user.email??null,
  emailConfirmed:Boolean(user.email_confirmed_at),
  deletionRequest:data?{
   id:data.id,
   status:data.status,
   reason:data.reason,
   requestedAt:data.requested_at,
   updatedAt:data.updated_at
  }:null
 });
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const reason=String(input.reason??"").trim().slice(0,500)||null;

 const {data:existing,error:readError}=await supabase
  .from("account_deletion_requests")
  .select("id,status")
  .eq("profile_id",user.id)
  .eq("status","requested")
  .maybeSingle();

 if(readError)return mobileJson(request,{ok:false,error:"account_security_unavailable"},503);
 if(existing)return mobileJson(request,{ok:true,alreadyPending:true,id:existing.id});

 const {data,error}=await supabase
  .from("account_deletion_requests")
  .insert({profile_id:user.id,reason,status:"requested"})
  .select("id,requested_at")
  .single();

 if(error||!data)return mobileJson(request,{ok:false,error:"account_deletion_request_failed"},503);

 return mobileJson(request,{ok:true,id:data.id,requestedAt:data.requested_at},201);
}

export async function DELETE(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const {error}=await supabase
  .from("account_deletion_requests")
  .update({status:"cancelled",updated_at:new Date().toISOString()})
  .eq("profile_id",user.id)
  .eq("status","requested");

 if(error)return mobileJson(request,{ok:false,error:"account_deletion_cancel_failed"},503);
 return mobileJson(request,{ok:true,cancelled:true});
}
