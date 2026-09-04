import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CatalogueVariant={id:string;make:string;modelFamily:string;variant:string;bodyType:string|null};
export type CatalogueEngine={fuelType:string;engineSizeSimple:number|null;engineSizeDesc:string|null};

export async function getCatalogueMakes(){
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("vehicle_catalogue_variants").select("make").eq("body_type","Cars").order("make");
 if(error)throw error;
 return [...new Set((data??[]).map(row=>row.make))];
}

export async function getCatalogueModels(make:string){
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("vehicle_catalogue_variants").select("model_family").eq("body_type","Cars").eq("make",make).order("model_family");
 if(error)throw error;
 return [...new Set((data??[]).map(row=>row.model_family))];
}

export async function getCatalogueVariants(make:string,modelFamily:string):Promise<CatalogueVariant[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("vehicle_catalogue_variants").select("id,make,model_family,variant,body_type").eq("body_type","Cars").eq("make",make).eq("model_family",modelFamily).order("variant");
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
 return (data??[]).map(row=>({fuelType:row.fuel_type,engineSizeSimple:row.engine_size_simple,engineSizeDesc:row.engine_size_desc}));
}
