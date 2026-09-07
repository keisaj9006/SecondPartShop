import { getListingCardsByIds } from "@/lib/data/marketplace";
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
 const rawLimit=Number(url.searchParams.get("limit")??24);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):24;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;

 const {data,error}=await supabase
  .from("saved_parts")
  .select("part_id,created_at")
  .eq("profile_id",user.id)
  .order("created_at",{ascending:false})
  .order("part_id")
  .range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"saved_unavailable"},503);

 const raw=data??[];
 const hasMore=raw.length>limit;
 const ids=raw.slice(0,limit).map(row=>row.part_id);
 const items=await getListingCardsByIds(ids).catch(()=>null);
 if(items===null)return mobileJson(request,{ok:false,error:"saved_unavailable"},503);
 return mobileJson(request,{ok:true,ids,items,pagination:{offset,limit,returned:items.length,hasMore}});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const partId=payload&&typeof payload==="object"&&"partId" in payload?String((payload as {partId?:unknown}).partId??""):"";
 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);

 const {data:existing}=await supabase
  .from("saved_parts")
  .select("part_id")
  .eq("profile_id",user.id)
  .eq("part_id",partId)
  .maybeSingle();

 if(existing){
  const {error}=await supabase.from("saved_parts").delete().eq("profile_id",user.id).eq("part_id",partId);
  if(error)return mobileJson(request,{ok:false,error:"save_failed"},503);
  return mobileJson(request,{ok:true,saved:false});
 }

 const {error}=await supabase.from("saved_parts").insert({profile_id:user.id,part_id:partId});
 if(error)return mobileJson(request,{ok:false,error:"save_failed"},503);
 return mobileJson(request,{ok:true,saved:true},201);
}
