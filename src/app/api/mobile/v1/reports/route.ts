import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const reasons=new Set(["suspected_counterfeit","incorrect_fitment","misleading_description","unsafe_item","seller_conduct","other"]);

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"&&!Array.isArray(body)?body as Record<string,unknown>:{};
 const partId=String(input.partId??"");
 const reason=String(input.reason??"");
 const details=String(input.details??"").trim().slice(0,1000)||null;
 if(!isUuid(partId)||!reasons.has(reason))return mobileJson(request,{ok:false,error:"invalid_report"},400);

 const {data:part,error:partError}=await supabase.from("parts").select("id,seller_id").eq("id",partId).maybeSingle();
 if(partError||!part)return mobileJson(request,{ok:false,error:"listing_not_available"},404);
 const {data:seller}=await supabase.from("sellers").select("owner_id").eq("id",part.seller_id).maybeSingle();
 if(seller?.owner_id===user.id)return mobileJson(request,{ok:false,error:"cannot_report_own_listing"},400);

 const {error}=await supabase.from("marketplace_reports").insert({
  reporter_id:user.id,
  part_id:part.id,
  seller_id:part.seller_id,
  reason,
  details
 });
 if(error)return mobileJson(request,{ok:false,error:"report_submit_failed"},503);
 return mobileJson(request,{ok:true,submitted:true},201);
}
