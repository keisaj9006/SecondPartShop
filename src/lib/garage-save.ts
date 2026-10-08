import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeUserDatabase } from "@/lib/supabase/runtime-user.types";
import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { isUuid } from "@/lib/identifiers";
import { consumeVehicleLookupRateLimit } from "@/lib/vehicle-lookup-operational";
import { isPlausibleUkRegistration,lookupVehicleByRegistration,normalizeRegistration } from "@/lib/vehicle-registration";

export type GarageSaveResult=
 | {ok:true;id:string;outcome:"created"|"already_exists"|"enriched";catalogueVariantId:string|null;message:string}
 | {ok:false;code:string;message:string;retryable:boolean};
const text=(input:unknown)=>typeof input==="string"?input.trim():"";
const failure=(code:string,message:string,retryable=false):GarageSaveResult=>({ok:false,code,message,retryable});

/** Caller authenticates; the invoker RPC derives ownership again from auth.uid(). */
export async function saveGarageVehicleForUser(supabase:SupabaseClient<RuntimeUserDatabase>,request:Request,input:Record<string,unknown>):Promise<GarageSaveResult>{
 const variantId=text(input.variantId)||null;
 const operation=text(input.operation)||(variantId?"enrich_exact":"");
 if(operation!=="identity_save"&&operation!=="enrich_exact")return failure("invalid_operation","Choose a vehicle lookup or an exact catalogue version before saving.");
 const rawRegistration=text(input.registration);
 const registration=rawRegistration?normalizeRegistration(rawRegistration):null;
 if(registration&&!isPlausibleUkRegistration(registration))return failure("invalid_registration","Check the registration and try again.");
 const garageId=text(input.garageVehicleId)||null;
 if(garageId&&!isUuid(garageId))return failure("invalid_vehicle","Select your saved vehicle again.");
 const nickname=text(input.nickname).slice(0,50)||null;
 let make:string,model:string,year:number,fuel:string|null,engine:number|null,colour:string|null;
 try{
  if(operation==="identity_save"){
   if(!registration||variantId||garageId)return failure("invalid_vehicle","Enter a registration to save the vehicle identity.");
   const rate=await consumeVehicleLookupRateLimit(request);
   if(rate.status==="unavailable")return failure("lookup_unavailable","Vehicle lookup is temporarily unavailable. Try again or choose the vehicle manually.",true);
   if(!rate.allowed)return failure("lookup_rate_limited","Too many registration lookups. Please wait a few minutes and try again.",true);
   const result=await lookupVehicleByRegistration(registration);
   if(result.status!=="found")return failure(result.status==="not_found"?"vehicle_not_found":"lookup_unavailable","The vehicle could not be confirmed. Try the lookup again or choose the vehicle manually.",result.status==="unavailable");
   const identity=result.vehicle;
   make=text(identity.make);model=text(identity.model);year=identity.year??NaN;
   if(!make||make.length>80||!model||model.length>120||!Number.isInteger(year)||year<1900||year>2100||result.registration!==registration)return failure("incomplete_identity","The lookup is missing vehicle details needed to save. Try again or choose the vehicle manually.");
   fuel=text(identity.fuelType)||null;engine=identity.engineSizeSimple??null;colour=text(identity.colour).slice(0,40)||null;
   if((fuel&&fuel.length>80)||(engine!==null&&(!Number.isInteger(engine)||engine<100||engine>10000)))return failure("incomplete_identity","The lookup returned incomplete fuel or engine information. Choose the vehicle manually.");
  }else{
   year=Number(input.year);
   const requestedFuel=text(input.fuel)||undefined;
   const engineInput=input.engine;
   const requestedEngine=engineInput===undefined||engineInput===null||engineInput===""?undefined:Number(engineInput);
   if(!variantId||!isUuid(variantId)||!Number.isInteger(year)||(requestedEngine!==undefined&&!Number.isInteger(requestedEngine)))return failure("invalid_vehicle","Choose an exact version and a valid year before saving.");
   const selection=await getCatalogueSelection(variantId,year,requestedFuel,requestedEngine);
   if(!selection)return failure("vehicle_not_found","That exact version could not be confirmed. Choose the vehicle again.");
   make=selection.make;model=selection.modelFamily;fuel=selection.fuelType;engine=selection.engineSizeSimple;colour=text(input.colour).slice(0,40)||null;
  }
  const {data,error}=await supabase.rpc("save_garage_vehicle_v1",{
   p_operation:operation,p_registration:registration,p_make:make,p_model:model,p_year:year,
   p_fuel:fuel,p_engine:engine,p_colour:colour,p_nickname:nickname,
   p_catalogue_variant_id:variantId,p_garage_vehicle_id:garageId
  });
  if(error)return failure("garage_save_failed","Your vehicle could not be saved. Please try again.",true);
  const row=data?.[0];
  if(row?.outcome==="reselect_required")return failure("reselect_required","This exact version does not match your saved vehicle, or its profile has changed. Select the vehicle and exact version again.");
  if(!row?.garage_vehicle_id||!["created","already_exists","enriched"].includes(row.outcome))return failure("garage_save_failed","Your vehicle could not be saved. Please try again.",true);
  const outcome=row.outcome as "created"|"already_exists"|"enriched";
  return {ok:true,id:row.garage_vehicle_id,outcome,catalogueVariantId:row.catalogue_variant_id,message:outcome==="already_exists"?"Vehicle already in your Garage":outcome==="enriched"?"Exact vehicle version saved":"Vehicle added to your Garage"};
 }catch{
  return failure("garage_save_failed","Your vehicle could not be confirmed or saved. Please try again or choose the vehicle manually.",true);
 }
}
