import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??24);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):24;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;

 const {data,error}=await supabase.rpc("seller_ranked_part_request_leads",{p_limit:limit,p_offset:offset});
 if(error)return mobileJson(request,{ok:false,error:"seller_requests_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 return mobileJson(request,{ok:true,items:page.map(row=>({
  id:row.request_id,
  queryText:row.query_text,
  oemNumber:row.oem_number,
  notes:row.notes,
  createdAt:row.created_at,
  categoryId:row.category_id,
  categoryName:row.category_name,
  variantId:row.catalogue_variant_id,
  vehicleMake:row.vehicle_make,
  vehicleModel:row.vehicle_model,
  vehicleVariant:row.vehicle_variant,
  year:row.year,
  fuelType:row.fuel_type,
  engineSizeSimple:row.engine_size_simple,
  matchScore:Number(row.match_score??0),
  matchReasons:row.match_reasons??[]
 })),pagination:{offset,limit,returned:page.length,hasMore}});
}
