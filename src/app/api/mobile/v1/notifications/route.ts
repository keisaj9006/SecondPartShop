import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const {data,error}=await supabase
  .from("notifications")
  .select("id,type,title,body,href,read_at,created_at")
  .eq("profile_id",user.id)
  .order("created_at",{ascending:false})
  .limit(100);
 if(error)return mobileJson(request,{ok:false,error:"notifications_unavailable"},503);

 const items=data??[];
 return mobileJson(request,{
  ok:true,
  unreadCount:items.filter(item=>!item.read_at).length,
  items:items.map(item=>({
   id:item.id,
   type:item.type,
   title:item.title,
   body:item.body,
   href:item.href,
   readAt:item.read_at,
   createdAt:item.created_at
  }))
 });
}

export async function PATCH(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
 const all=input.all===true;
 const id=String(input.id??"");
 const readAt=new Date().toISOString();

 if(all){
  const {error}=await supabase.from("notifications").update({read_at:readAt}).eq("profile_id",user.id).is("read_at",null);
  if(error)return mobileJson(request,{ok:false,error:"notification_update_failed"},503);
  return mobileJson(request,{ok:true,allRead:true});
 }

 if(!isUuid(id))return mobileJson(request,{ok:false,error:"invalid_notification"},400);
 const {error}=await supabase.from("notifications").update({read_at:readAt}).eq("id",id).eq("profile_id",user.id);
 if(error)return mobileJson(request,{ok:false,error:"notification_update_failed"},503);
 return mobileJson(request,{ok:true,id,readAt});
}
