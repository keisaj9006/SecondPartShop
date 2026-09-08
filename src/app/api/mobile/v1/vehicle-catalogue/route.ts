import {
 getCatalogueEngines,
 getCatalogueMakes,
 getCatalogueSelection,
 getCatalogueModels,
 getCatalogueVariants,
 getCatalogueVariantsForModelYear,
 getCatalogueYears,
 getCatalogueYearsForModel
} from "@/lib/data/vehicle-catalogue";
import { mobileJson,mobileOptions,mobilePublicJson } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const clean=(value:string|null)=>value?.trim().slice(0,100)??"";
const yearValue=(value:string|null)=>{
 const parsed=Number(value);
 return Number.isInteger(parsed)&&parsed>=1900&&parsed<=2100?parsed:null;
};

export async function GET(request:Request){
 const {searchParams}=new URL(request.url);
 const level=clean(searchParams.get("level"));

 try{
  if(level==="makes")return mobilePublicJson(request,{ok:true,items:await getCatalogueMakes()});
  if(level==="models"){
   const make=clean(searchParams.get("make"));
   if(!make)return mobileJson(request,{ok:false,error:"make_required"},400);
   return mobilePublicJson(request,{ok:true,items:await getCatalogueModels(make)},200,3600,86400);
  }
  if(level==="years-model"){
   const make=clean(searchParams.get("make"));
   const model=clean(searchParams.get("model"));
   if(!make||!model)return mobileJson(request,{ok:false,error:"make_model_required"},400);
   return mobilePublicJson(request,{ok:true,items:await getCatalogueYearsForModel(make,model)},200,3600,86400);
  }
  if(level==="variants-year"){
   const make=clean(searchParams.get("make"));
   const model=clean(searchParams.get("model"));
   const year=yearValue(searchParams.get("year"));
   if(!make||!model||!year)return mobileJson(request,{ok:false,error:"make_model_year_required"},400);
   return mobilePublicJson(request,{ok:true,items:await getCatalogueVariantsForModelYear(make,model,year)},200,3600,86400);
  }
  if(level==="variants"){
   const make=clean(searchParams.get("make"));
   const model=clean(searchParams.get("model"));
   if(!make||!model)return mobileJson(request,{ok:false,error:"make_model_required"},400);
   return mobilePublicJson(request,{ok:true,items:await getCatalogueVariants(make,model)},200,3600,86400);
  }
  if(level==="years"){
   const variantId=clean(searchParams.get("variantId"));
   if(!variantId)return mobileJson(request,{ok:false,error:"variant_required"},400);
   return mobilePublicJson(request,{ok:true,items:await getCatalogueYears(variantId)},200,3600,86400);
  }
  if(level==="engines"){
   const variantId=clean(searchParams.get("variantId"));
   if(!variantId)return mobileJson(request,{ok:false,error:"variant_required"},400);
   return mobilePublicJson(request,{ok:true,items:await getCatalogueEngines(variantId)},200,3600,86400);
  }
  if(level==="selection"){
   const variantId=clean(searchParams.get("variantId"));
   const year=yearValue(searchParams.get("year"));
   const fuel=clean(searchParams.get("fuel"))||undefined;
   const engineRaw=searchParams.get("engine");
   const engine=engineRaw===null||engineRaw===""?undefined:Number(engineRaw);
   if(!variantId||!year|| (engine!==undefined&&!Number.isInteger(engine)))return mobileJson(request,{ok:false,error:"invalid_vehicle_selection"},400);
   const item=await getCatalogueSelection(variantId,year,fuel,engine);
   if(!item)return mobileJson(request,{ok:false,error:"vehicle_not_found"},404);
   return mobileJson(request,{ok:true,item},200,3600,86400);
  }
  return mobileJson(request,{ok:false,error:"unknown_catalogue_level"},400);
 }catch{
  return mobileJson(request,{ok:false,error:"vehicle_catalogue_unavailable"},503);
 }
}
