import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DonorVehicle } from "@/lib/types";

export async function getDonorVehicles(sellerId:string):Promise<DonorVehicle[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("donor_vehicles")
  .select("id,seller_id,registration,make,model,variant,year,fuel_type,engine_size_simple,colour,notes,created_at")
  .eq("seller_id",sellerId)
  .order("created_at",{ascending:false});
 if(error)throw error;
 return (data??[]).map(row=>({
  id:row.id,
  sellerId:row.seller_id,
  registration:row.registration,
  make:row.make,
  model:row.model,
  variant:row.variant,
  year:row.year,
  fuelType:row.fuel_type,
  engineSizeSimple:row.engine_size_simple,
  colour:row.colour,
  notes:row.notes,
  createdAt:row.created_at
 }));
}

export async function getDonorVehicle(id:string,sellerId:string):Promise<DonorVehicle|null>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("donor_vehicles")
  .select("id,seller_id,registration,make,model,variant,year,fuel_type,engine_size_simple,colour,notes,created_at")
  .eq("id",id)
  .eq("seller_id",sellerId)
  .maybeSingle();
 if(error)throw error;
 return data?{
  id:data.id,
  sellerId:data.seller_id,
  registration:data.registration,
  make:data.make,
  model:data.model,
  variant:data.variant,
  year:data.year,
  fuelType:data.fuel_type,
  engineSizeSimple:data.engine_size_simple,
  colour:data.colour,
  notes:data.notes,
  createdAt:data.created_at
 }:null;
}
