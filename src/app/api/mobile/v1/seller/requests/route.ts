import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export function OPTIONS(request:Request){return mobileOptions(request);}
const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const {data,error}=await supabase
  .from("seller_part_request_leads")
  .select("request_id,query_text,oem_number,notes,created_at,category_id,catalogue_variant_id,year,fuel_type,engine_size_simple,categories(name),vehicle_catalogue_variants(make,model_family,variant)")
  .eq("status","open")
  .order("created_at",{ascending:false});
 if(error)return mobileJson(request,{ok:false,error:"seller_requests_unavailable"},503);
 return mobileJson(request,{ok:true,items:(data??[]).map(row=>{
  const category=one(row.categories);
  const vehicle=one(row.vehicle_catalogue_variants);
  return {
   id:row.request_id,queryText:row.query_text,oemNumber:row.oem_number,notes:row.notes,createdAt:row.created_at,
   categoryId:row.category_id,categoryName:category?.name??null,variantId:row.catalogue_variant_id,
   vehicleMake:vehicle?.make??null,vehicleModel:vehicle?.model_family??null,vehicleVariant:vehicle?.variant??null,
   year:row.year,fuelType:row.fuel_type,engineSizeSimple:row.engine_size_simple
  };
 })});
}
