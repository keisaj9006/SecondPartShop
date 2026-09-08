import { mobileJson,mobileOptions } from "@/lib/mobile-api";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??40);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):40;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const query=String(url.searchParams.get("q")??"").replace(/[^a-zA-Z0-9 -]/g," ").replace(/\s+/g," ").trim().slice(0,80);
 const supabase=createSupabasePublicServerClient();
 let builder=supabase
  .from("garage_partners")
  .select("id,business_name,slug,location,postcode,description,mobile_fitting,verified_at")
  .eq("status","active")
  .eq("customer_supplied_parts",true)
  .eq("recycled_parts",true);
 if(query){
  const pattern="%"+query+"%";
  builder=builder.or("business_name.ilike."+pattern+",location.ilike."+pattern+",postcode.ilike."+pattern);
 }
 const {data,error}=await builder
  .order("verified_at",{ascending:false,nullsFirst:false})
  .order("business_name")
  .order("id")
  .range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"garages_unavailable"},503);
 const rows=data??[];
 return mobileJson(request,{
  ok:true,
  items:rows.slice(0,limit).map(row=>({
   id:row.id,businessName:row.business_name,slug:row.slug,location:row.location,postcode:row.postcode,
   description:row.description,mobileFitting:row.mobile_fitting,verified:Boolean(row.verified_at)
  })),
  query:query||null,
  pagination:{offset,limit,hasMore:rows.length>limit}
 });
}
