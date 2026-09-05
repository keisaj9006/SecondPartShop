import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CatalogueFitmentSelection } from "@/lib/types";

type RawFitment={
 id:string;
 variant_id:string;
 year_from:number|null;
 year_to:number|null;
 fuel_type:string|null;
 engine_size_simple:number|null;
 notes:string|null;
 vehicle_catalogue_variants:{make:string;model_family:string;variant:string}|{make:string;model_family:string;variant:string}[]|null;
};

const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;

export async function getCatalogueFitmentsForPart(partId:string):Promise<CatalogueFitmentSelection[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("part_catalogue_fitments")
  .select("id,variant_id,year_from,year_to,fuel_type,engine_size_simple,notes,vehicle_catalogue_variants!inner(make,model_family,variant)")
  .eq("part_id",partId)
  .order("created_at");
 if(error)throw error;
 return (data??[]).flatMap(row=>{
  const raw=row as unknown as RawFitment;
  const vehicle=raw.vehicle_catalogue_variants?one(raw.vehicle_catalogue_variants):null;
  if(!vehicle||raw.year_from===null||raw.year_to===null||raw.year_from!==raw.year_to)return [];
  return [{
   id:raw.id,
   variantId:raw.variant_id,
   make:vehicle.make,
   modelFamily:vehicle.model_family,
   variant:vehicle.variant,
   year:raw.year_from,
   fuelType:raw.fuel_type,
   engineSizeSimple:raw.engine_size_simple,
   notes:raw.notes
  }];
 });
}


export async function getCatalogueFitmentCounts(partIds:string[]):Promise<Map<string,number>>{
 if(!partIds.length)return new Map();
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("part_catalogue_fitments")
  .select("part_id")
  .in("part_id",partIds);
 if(error)throw error;
 const counts=new Map<string,number>();
 for(const row of data??[])counts.set(row.part_id,(counts.get(row.part_id)??0)+1);
 return counts;
}
