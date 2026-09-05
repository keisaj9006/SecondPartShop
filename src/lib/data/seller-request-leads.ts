import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SellerPartRequestLead } from "@/lib/types";

export async function getSellerPartRequestLeads():Promise<SellerPartRequestLead[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("seller_open_part_request_leads");
 if(error)throw error;
 return (data??[]).map(row=>({
  id:row.id,
  queryText:row.query_text,
  oemNumber:row.oem_number,
  notes:row.notes,
  createdAt:row.created_at,
  categoryId:row.category_id,
  categoryName:row.category_name,
  variantId:row.variant_id,
  vehicleMake:row.vehicle_make,
  vehicleModel:row.vehicle_model,
  vehicleVariant:row.vehicle_variant,
  year:row.year,
  fuelType:row.fuel_type,
  engineSizeSimple:row.engine_size_simple
 }));
}
