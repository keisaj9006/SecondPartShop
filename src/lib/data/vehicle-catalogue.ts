import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VehicleCatalogueSelection } from "@/lib/types";

export type CatalogueModelOption={make:string;modelFamily:string};
export type CatalogueVariant={id:string;make:string;modelFamily:string;variant:string;bodyType:string|null};
export type CatalogueVariantOption={id:string;variant:string};
export type CatalogueEngine={fuelType:string;engineSizeSimple:number|null;engineSizeDesc:string|null};

export async function getCatalogueModelMap():Promise<CatalogueModelOption[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("vehicle_catalogue_model_map_json");
 if(error)throw error;
 if(!Array.isArray(data))return [];
 return data.flatMap(item=>{
  if(typeof item!=="object"||item===null||Array.isArray(item))return [];
  const row=item as {make?:unknown;modelFamily?:unknown};
  return typeof row.make==="string"&&typeof row.modelFamily==="string"?[{make:row.make,modelFamily:row.modelFamily}]:[];
 });
}

export async function getCatalogueMakes(){
 const map=await getCatalogueModelMap();
 return [...new Set(map.map(row=>row.make))];
}

export async function getCatalogueModels(make:string){
 const map=await getCatalogueModelMap();
 return map.filter(row=>row.make===make).map(row=>row.modelFamily);
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

export async function getCatalogueYearsForModel(make:string,modelFamily:string){
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("vehicle_catalogue_years_for_model",{p_make:make,p_model:modelFamily});
 if(error)throw error;
 return (data??[]).map(row=>row.year_first_used);
}

export async function getCatalogueVariantsForModelYear(make:string,modelFamily:string,year:number):Promise<CatalogueVariantOption[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("vehicle_catalogue_variants_for_model_year",{p_make:make,p_model:modelFamily,p_year:year});
 if(error)throw error;
 return (data??[]).map(row=>({id:row.id,variant:row.variant}));
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
 let engineQuery=supabase.from("vehicle_catalogue_engines").select("fuel_type,engine_size_simple").eq("variant_id",variantId);
 if(fuelType)engineQuery=engineQuery.eq("fuel_type",fuelType);
 if(engineSizeSimple!==undefined)engineQuery=engineQuery.eq("engine_size_simple",engineSizeSimple);
 const [variantResult,yearResult,engineResult]=await Promise.all([
  supabase.from("vehicle_catalogue_variants").select("id,make,model_family,variant").eq("provider","dft").eq("body_type","Cars").eq("id",variantId).maybeSingle(),
  supabase.from("vehicle_catalogue_years").select("year_first_used").eq("variant_id",variantId).eq("year_first_used",year).maybeSingle(),
  fuelType?engineQuery.limit(1):Promise.resolve({data:null,error:null})
 ]);
 if(variantResult.error)throw variantResult.error;
 if(yearResult.error)throw yearResult.error;
 if(engineResult.error)throw engineResult.error;
 if(!variantResult.data||!yearResult.data)return null;
 if(fuelType&&!engineResult.data?.length)return null;
 const variant=variantResult.data;
 return {variantId:variant.id,make:variant.make,modelFamily:variant.model_family,variant:variant.variant,year,fuelType:fuelType??null,engineSizeSimple:engineSizeSimple??null};
}

const normalizeVehicleName=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
const fuelComparable=(value:string)=>normalizeVehicleName(value).replace("BATTERY ELECTRIC","ELECTRIC").replace("HYBRID ELECTRIC","HYBRID");

export async function matchRegistrationToCatalogue(vehicle:{make:string;model:string;year?:number;fuelType?:string;engineSizeSimple?:number|null}){
 const modelMap=await getCatalogueModelMap();
 const makeKey=normalizeVehicleName(vehicle.make);
 const modelKey=normalizeVehicleName(vehicle.model);
 const makeOptions=[...new Set(modelMap.map(row=>row.make))];
 const matchedMake=makeOptions.find(make=>normalizeVehicleName(make)===makeKey);
 if(!matchedMake)return {make:null,modelFamily:null,variants:[] as CatalogueVariantOption[],engineMatched:false};
 const modelOptions=modelMap.filter(row=>row.make===matchedMake).map(row=>row.modelFamily);
 const exact=modelOptions.find(model=>normalizeVehicleName(model)===modelKey);
 const close=exact??modelOptions.find(model=>normalizeVehicleName(model).includes(modelKey)||modelKey.includes(normalizeVehicleName(model)));
 if(!close||!vehicle.year)return {make:matchedMake,modelFamily:close??null,variants:[] as CatalogueVariantOption[],engineMatched:false};
 let variants=await getCatalogueVariantsForModelYear(matchedMake,close,vehicle.year);
 let engineMatched=false;
 if((vehicle.fuelType||vehicle.engineSizeSimple)&&variants.length){
  const supabase=await createSupabaseServerClient();
  const variantIds=variants.map(item=>item.id);
  let query=supabase.from("vehicle_catalogue_engines").select("variant_id,fuel_type,engine_size_simple").in("variant_id",variantIds);
  if(vehicle.engineSizeSimple)query=query.eq("engine_size_simple",vehicle.engineSizeSimple);
  const {data,error}=await query;
  if(error)throw error;
  const matchingIds=new Set((data??[]).filter(row=>!vehicle.fuelType||fuelComparable(row.fuel_type)===fuelComparable(vehicle.fuelType)).map(row=>row.variant_id));
  if(matchingIds.size){variants=variants.filter(item=>matchingIds.has(item.id));engineMatched=true;}
 }
 return {make:matchedMake,modelFamily:close,variants,engineMatched};
}
