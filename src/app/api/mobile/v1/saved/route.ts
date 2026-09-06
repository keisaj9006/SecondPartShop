import { getListings } from "@/lib/data/marketplace";
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
  .from("saved_parts")
  .select("part_id")
  .eq("profile_id",user.id);
 if(error)return mobileJson(request,{ok:false,error:"saved_unavailable"},503);

 const ids=(data??[]).map(row=>row.part_id);
 if(!ids.length)return mobileJson(request,{ok:true,ids:[],items:[]});
 const result=await getListings({ids});
 if(result.error)return mobileJson(request,{ok:false,error:"saved_unavailable"},503);
 return mobileJson(request,{ok:true,ids,items:result.data});
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
