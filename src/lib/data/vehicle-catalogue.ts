import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VehicleCatalogueSelection } from "@/lib/types";

export type CatalogueVariant={id:string;make:string;modelFamily:string;variant:string;bodyType:string|null};
export type CatalogueEngine={fuelType:string;engineSizeSimple:number|null;engineSizeDesc:string|null};

export async function getCatalogueMakes(){
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("vehicle_catalogue_makes");
 if(error)throw error;
 return (data??[]).map(row=>row.make);
}

export async function getCatalogueModels(make:string){
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("vehicle_catalogue_models",{p_make:make});
 if(error)throw error;
 return (data??[]).map(row=>row.model_family);
}

export async function getCatalogueVariants(make:string,modelFamily:string):Promise<CatalogueVariant[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("vehicle_catalogue_variants").select("id,make,model_family,variant,body_type").eq("provider","dft").eq("body_type","Cars").eq("make",make).eq("model_family",modelFamily).order("variant");
 if(error)throw error;
 return (data??[]).map(row=>({id:row.id,make:row.make,modelFamily:row.model_family,variant:row.variant,bodyType:row.body_type}));
}

export async function getCatalogueYears(variantId:string){
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("vehicle_catalogue_years").select("year_first_used").eq("variant_id",variantId).order("year_first_used",{ascending:false});
 if(error)throw error;
 return (data??[]).map(row=>row.year_first_used);
}

export async function getCatalogueEngines(variantId:string):Promise<CatalogueEngine[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("vehicle_catalogue_engines").select("fuel_type,engine_size_simple,engine_size_desc").eq("variant_id",variantId).order("fuel_type").order("engine_size_simple");
 if(error)throw error;
 const filtered=(data??[]).filter(row=>{
  if(row.engine_size_simple===null)return row.fuel_type.includes("ELECTRIC");
  return row.engine_size_simple>=200&&row.engine_size_simple<=10000;
 });
 const unique=new Map<string,CatalogueEngine>();
 for(const row of filtered){
  const key=`${row.fuel_type}\u001f${row.engine_size_simple??""}`;
  if(!unique.has(key))unique.set(key,{fuelType:row.fuel_type,engineSizeSimple:row.engine_size_simple,engineSizeDesc:row.engine_size_desc});
 }
 return [...unique.values()];
}

export async function getCatalogueSelection(variantId:string,year:number,fuelType?:string,engineSizeSimple?:number):Promise<VehicleCatalogueSelection|null>{
 const supabase=await createSupabaseServerClient();
 const {data:variant,error:variantError}=await supabase.from("vehicle_catalogue_variants").select("id,make,model_family,variant").eq("provider","dft").eq("body_type","Cars").eq("id",variantId).maybeSingle();
 if(variantError)throw variantError;
 if(!variant)return null;
 const {data:yearRow,error:yearError}=await supabase.from("vehicle_catalogue_years").select("year_first_used").eq("variant_id",variantId).eq("year_first_used",year).maybeSingle();
 if(yearError)throw yearError;
 if(!yearRow)return null;
 if(fuelType){
  let engineQuery=supabase.from("vehicle_catalogue_engines").select("fuel_type,engine_size_simple").eq("variant_id",variantId).eq("fuel_type",fuelType);
  if(engineSizeSimple!==undefined)engineQuery=engineQuery.eq("engine_size_simple",engineSizeSimple);
  const {data:engineRows,error:engineError}=await engineQuery.limit(1);
  if(engineError)throw engineError;
  if(!engineRows?.length)return null;
 }
 return {variantId:variant.id,make:variant.make,modelFamily:variant.model_family,variant:variant.variant,year,fuelType:fuelType??null,engineSizeSimple:engineSizeSimple??null};
}
