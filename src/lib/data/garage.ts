import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { GarageVehicle } from "@/lib/types";

type RawGarageVehicle={
 id:string;
 catalogue_variant_id:string;
 registration:string|null;
 year:number;
 fuel_type:string|null;
 engine_size_simple:number|null;
 nickname:string|null;
 created_at:string;
 vehicle_catalogue_variants:{make:string;model_family:string;variant:string}|{make:string;model_family:string;variant:string}[]|null;
};

const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;

export async function getGarageVehicles(profileId:string):Promise<GarageVehicle[]>{
 if(!isSupabaseConfigured())return [];
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("garage_vehicles")
  .select("id,catalogue_variant_id,registration,year,fuel_type,engine_size_simple,nickname,created_at,vehicle_catalogue_variants!inner(make,model_family,variant)")
  .eq("profile_id",profileId)
  .order("created_at",{ascending:false});
 if(error)throw error;
 return (data??[]).flatMap(row=>{
  const raw=row as unknown as RawGarageVehicle;
  const variant=raw.vehicle_catalogue_variants?one(raw.vehicle_catalogue_variants):null;
  if(!variant)return [];
  return [{
   id:raw.id,
   catalogueVariantId:raw.catalogue_variant_id,
   registration:raw.registration,
   year:raw.year,
   fuelType:raw.fuel_type,
   engineSizeSimple:raw.engine_size_simple,
   nickname:raw.nickname,
   make:variant.make,
   modelFamily:variant.model_family,
   variant:variant.variant,
   createdAt:raw.created_at
  }];
 });
}
