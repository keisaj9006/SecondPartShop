import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/identifiers";
import type { RuntimeUserDatabase } from "@/lib/supabase/runtime-user.types";

export type CheckoutGarageVehicle={
 catalogueVariantId:string;
 year:number;
 fuelType:string|null;
 engineSizeSimple:number|null;
 registration:string|null;
};

export type CheckoutGarageVehicleResult=
 |{status:"valid";vehicle:CheckoutGarageVehicle}
 |{status:"invalid_id"|"unavailable"|"incomplete"};

export async function resolveOwnedGarageVehicleForCheckout(
 supabase:SupabaseClient<RuntimeUserDatabase>,
 ownerId:string,
 garageVehicleId:string
):Promise<CheckoutGarageVehicleResult>{
 if(!isUuid(garageVehicleId))return {status:"invalid_id"};
 const {data,error}=await supabase.from("garage_vehicles")
  .select("id,catalogue_variant_id,year,fuel_type,engine_size_simple,registration")
  .eq("profile_id",ownerId)
  .eq("id",garageVehicleId)
  .maybeSingle();
 if(error||!data)return {status:"unavailable"};
 const year=Number(data.year);
 if(!data.catalogue_variant_id||!isUuid(data.catalogue_variant_id)||!Number.isInteger(year)||year<1886||year>new Date().getUTCFullYear()+1){
  return {status:"incomplete"};
 }
 return {status:"valid",vehicle:{
  catalogueVariantId:data.catalogue_variant_id,
  year,
  fuelType:data.fuel_type,
  engineSizeSimple:data.engine_size_simple,
  registration:data.registration
 }};
}
