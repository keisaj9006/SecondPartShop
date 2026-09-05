import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PartRequest } from "@/lib/types";

type RawRequest={
 id:string;
 query_text:string;
 oem_number:string|null;
 notes:string|null;
 status:"open"|"closed";
 registration:string|null;
 year:number|null;
 fuel_type:string|null;
 engine_size_simple:number|null;
 created_at:string;
 categories:{name:string}|{name:string}[]|null;
 vehicle_catalogue_variants:{make:string;model_family:string;variant:string}|{make:string;model_family:string;variant:string}[]|null;
};
const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;

export async function getPartRequests(profileId:string):Promise<PartRequest[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("part_requests")
  .select("id,query_text,oem_number,notes,status,registration,year,fuel_type,engine_size_simple,created_at,categories(name),vehicle_catalogue_variants(make,model_family,variant)")
  .eq("profile_id",profileId)
  .order("created_at",{ascending:false});
 if(error)throw error;
 return (data??[]).map(row=>{
  const raw=row as unknown as RawRequest;
  const category=raw.categories?one(raw.categories):null;
  const vehicle=raw.vehicle_catalogue_variants?one(raw.vehicle_catalogue_variants):null;
  const vehicleLabel=vehicle
   ?[vehicle.make+" "+vehicle.model_family,raw.year?String(raw.year):null,raw.engine_size_simple?String(raw.engine_size_simple)+"cc":null,raw.fuel_type].filter(Boolean).join(" · ")
   :null;
  return {id:raw.id,queryText:raw.query_text,oemNumber:raw.oem_number,notes:raw.notes,status:raw.status,registration:raw.registration,year:raw.year,fuelType:raw.fuel_type,engineSizeSimple:raw.engine_size_simple,createdAt:raw.created_at,categoryName:category?.name??null,vehicleLabel};
 });
}
