import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SellerPartRequestLead } from "@/lib/types";

type RawLead={
 request_id:string;
 query_text:string;
 oem_number:string|null;
 notes:string|null;
 created_at:string;
 category_id:string|null;
 catalogue_variant_id:string|null;
 year:number|null;
 fuel_type:string|null;
 engine_size_simple:number|null;
 categories:{name:string}|{name:string}[]|null;
 vehicle_catalogue_variants:{make:string;model_family:string;variant:string}|{make:string;model_family:string;variant:string}[]|null;
};

const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;

export async function getSellerPartRequestLeads():Promise<SellerPartRequestLead[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("seller_part_request_leads")
  .select("request_id,query_text,oem_number,notes,created_at,category_id,catalogue_variant_id,year,fuel_type,engine_size_simple,categories(name),vehicle_catalogue_variants(make,model_family,variant)")
  .eq("status","open")
  .order("created_at",{ascending:false});
 if(error)throw error;
 return (data??[]).map(row=>{
  const raw=row as unknown as RawLead;
  const category=raw.categories?one(raw.categories):null;
  const vehicle=raw.vehicle_catalogue_variants?one(raw.vehicle_catalogue_variants):null;
  return {
   id:raw.request_id,
   queryText:raw.query_text,
   oemNumber:raw.oem_number,
   notes:raw.notes,
   createdAt:raw.created_at,
   categoryId:raw.category_id,
   categoryName:category?.name??null,
   variantId:raw.catalogue_variant_id,
   vehicleMake:vehicle?.make??null,
   vehicleModel:vehicle?.model_family??null,
   vehicleVariant:vehicle?.variant??null,
   year:raw.year,
   fuelType:raw.fuel_type,
   engineSizeSimple:raw.engine_size_simple
  };
 });
}
