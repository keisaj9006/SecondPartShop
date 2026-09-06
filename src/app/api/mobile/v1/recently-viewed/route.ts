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
  .from("recently_viewed_parts")
  .select("part_id,viewed_at")
  .eq("profile_id",user.id)
  .order("viewed_at",{ascending:false})
  .limit(30);
 if(error)return mobileJson(request,{ok:false,error:"recently_viewed_unavailable"},503);

 const ids=(data??[]).map(row=>row.part_id);
 if(!ids.length)return mobileJson(request,{ok:true,items:[]});

 const listings=await getListings({ids});
 if(listings.error)return mobileJson(request,{ok:false,error:"recently_viewed_unavailable"},503);
 const byId=new Map(listings.data.map(item=>[item.id,item]));
 return mobileJson(request,{ok:true,items:ids.map(id=>byId.get(id)).filter(Boolean)});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const partId=String(input.partId??"");
 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);

 const {error}=await supabase.from("recently_viewed_parts").upsert({
  profile_id:user.id,
  part_id:partId,
  viewed_at:new Date().toISOString()
 },{onConflict:"profile_id,part_id"});

 if(error)return mobileJson(request,{ok:false,error:"recent_view_failed"},503);
 return mobileJson(request,{ok:true});
}
