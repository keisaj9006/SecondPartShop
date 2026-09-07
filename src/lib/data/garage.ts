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
 colour:string|null;
 nickname:string|null;
 created_at:string;
 vehicle_catalogue_variants:{make:string;model_family:string;variant:string}|{make:string;model_family:string;variant:string}[]|null;
};

const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;

const mapGarageRows=(rows:unknown[]):GarageVehicle[]=>rows.flatMap(row=>{
 const raw=row as RawGarageVehicle;
 const variant=raw.vehicle_catalogue_variants?one(raw.vehicle_catalogue_variants):null;
 if(!variant)return [];
 return [{
  id:raw.id,
  catalogueVariantId:raw.catalogue_variant_id,
  registration:raw.registration,
  year:raw.year,
  fuelType:raw.fuel_type,
  engineSizeSimple:raw.engine_size_simple,
  colour:raw.colour,
  nickname:raw.nickname,
  make:variant.make,
  modelFamily:variant.model_family,
  variant:variant.variant,
  createdAt:raw.created_at
 }];
});

export async function getGarageVehiclesPage(profileId:string,options:{offset?:number;limit?:number}={}):Promise<{items:GarageVehicle[];hasMore:boolean;offset:number;limit:number}>{
 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??20),60));
 if(!isSupabaseConfigured())return {items:[],hasMore:false,offset,limit};
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("garage_vehicles")
  .select("id,catalogue_variant_id,registration,year,fuel_type,engine_size_simple,colour,nickname,created_at,vehicle_catalogue_variants!inner(make,model_family,variant)")
  .eq("profile_id",profileId)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false})
  .range(offset,offset+limit);
 if(error)throw error;
 const raw=data??[];
 return {items:mapGarageRows(raw.slice(0,limit) as unknown[]),hasMore:raw.length>limit,offset,limit};
}

export async function getGarageVehicleMatch(profileId:string,selection:{catalogueVariantId:string;year:number;fuelType:string|null;engineSizeSimple:number|null;registration?:string|null}):Promise<GarageVehicle|null>{
 if(!isSupabaseConfigured())return null;
 const supabase=await createSupabaseServerClient();
 let query=supabase
  .from("garage_vehicles")
  .select("id,catalogue_variant_id,registration,year,fuel_type,engine_size_simple,colour,nickname,created_at,vehicle_catalogue_variants!inner(make,model_family,variant)")
  .eq("profile_id",profileId)
  .eq("catalogue_variant_id",selection.catalogueVariantId)
  .eq("year",selection.year);
 query=selection.fuelType===null?query.is("fuel_type",null):query.eq("fuel_type",selection.fuelType);
 query=selection.engineSizeSimple===null?query.is("engine_size_simple",null):query.eq("engine_size_simple",selection.engineSizeSimple);
 if(selection.registration)query=query.eq("registration",selection.registration);
 const {data,error}=await query.order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!data)return null;
 return mapGarageRows([data] as unknown[])[0]??null;
}

export async function getGarageVehicles(profileId:string):Promise<GarageVehicle[]>{
 return (await getGarageVehiclesPage(profileId,{limit:60})).items;
}
