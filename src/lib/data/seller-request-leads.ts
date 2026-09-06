import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SellerPartRequestLead } from "@/lib/types";

export async function getSellerPartRequestLeads(options:{offset?:number;limit?:number}={}):Promise<{items:SellerPartRequestLead[];hasMore:boolean;offset:number;limit:number}>{
 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??30),60));
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("seller_ranked_part_request_leads",{p_limit:limit,p_offset:offset});
 if(error)throw new Error("Buyer request matching is temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>limit;
 const items=raw.slice(0,limit).map(row=>({
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
 }));
 return {items,hasMore,offset,limit};
}
