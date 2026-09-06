import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const handlePattern=/^[a-z0-9][a-z0-9-]{2,31}$/;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const {data,error}=await supabase
  .from("profiles")
  .select("id,display_name,handle,bio,phone,created_at")
  .eq("id",user.id)
  .maybeSingle();

 if(error)return mobileJson(request,{ok:false,error:"profile_unavailable"},503);
 if(!data)return mobileJson(request,{ok:false,error:"profile_not_found"},404);

 return mobileJson(request,{ok:true,profile:{
  id:data.id,
  displayName:data.display_name,
  handle:data.handle,
  bio:data.bio,
  phone:data.phone,
  createdAt:data.created_at
 }});
}

export async function PATCH(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};

 const displayName=String(input.displayName??"").trim();
 const handle=String(input.handle??"").trim().toLowerCase();
 const bio=String(input.bio??"").trim();
 const phone=String(input.phone??"").trim();

 if(displayName.length<2||displayName.length>100)return mobileJson(request,{ok:false,error:"invalid_display_name"},400);
 if(!handlePattern.test(handle))return mobileJson(request,{ok:false,error:"invalid_username"},400);
 if(bio.length>500)return mobileJson(request,{ok:false,error:"bio_too_long"},400);
 if(phone.length>50)return mobileJson(request,{ok:false,error:"phone_too_long"},400);

 const {data:existing,error:lookupError}=await supabase
  .from("profiles")
  .select("id")
  .eq("handle",handle)
  .neq("id",user.id)
  .maybeSingle();

 if(lookupError)return mobileJson(request,{ok:false,error:"username_check_failed"},503);
 if(existing)return mobileJson(request,{ok:false,error:"username_taken"},409);

 const {data,error}=await supabase
  .from("profiles")
  .update({
   display_name:displayName,
   handle,
   bio:bio||null,
   phone:phone||null
  })
  .eq("id",user.id)
  .select("id,display_name,handle,bio,phone,created_at")
  .single();

 if(error||!data)return mobileJson(request,{ok:false,error:"profile_update_failed"},503);

 return mobileJson(request,{ok:true,profile:{
  id:data.id,
  displayName:data.display_name,
  handle:data.handle,
  bio:data.bio,
  phone:data.phone,
  createdAt:data.created_at
 }});
}
