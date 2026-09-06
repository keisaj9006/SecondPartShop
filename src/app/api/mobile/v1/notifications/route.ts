import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??30);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):30;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const unreadOnly=url.searchParams.get("unread")==="1";

 let pageQuery=supabase
  .from("notifications")
  .select("id,type,title,body,href,read_at,created_at")
  .eq("profile_id",user.id)
  .order("created_at",{ascending:false})
  .order("id");
 if(unreadOnly)pageQuery=pageQuery.is("read_at",null);

 const [{data,error},{count:unreadCount,error:countError}]=await Promise.all([
  pageQuery.range(offset,offset+limit),
  supabase.from("notifications").select("id",{count:"exact",head:true}).eq("profile_id",user.id).is("read_at",null)
 ]);
 if(error||countError)return mobileJson(request,{ok:false,error:"notifications_unavailable"},503);

 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);
 return mobileJson(request,{
  ok:true,
  unreadCount:unreadCount??0,
  items:page.map(item=>({
   id:item.id,
   type:item.type,
   title:item.title,
   body:item.body,
   href:item.href,
   readAt:item.read_at,
   createdAt:item.created_at
  })),
  pagination:{offset,limit,returned:page.length,hasMore}
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
