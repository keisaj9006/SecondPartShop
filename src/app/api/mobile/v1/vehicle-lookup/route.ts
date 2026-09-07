import { matchRegistrationToCatalogue } from "@/lib/data/vehicle-catalogue";
import { mobileJson,mobileOptions } from "@/lib/mobile-api";
import { isPlausibleUkRegistration,lookupVehicleByRegistration,normalizeRegistration } from "@/lib/vehicle-registration";
import { consumeVehicleLookupRateLimit } from "@/lib/vehicle-lookup-operational";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function POST(request:Request){
 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}

 const registration=normalizeRegistration(
  typeof body==="object"&&body!==null&&"registration" in body
   ?String((body as {registration?:unknown}).registration??"")
   :""
 );
 if(!isPlausibleUkRegistration(registration)){
  return mobileJson(request,{ok:false,error:"invalid_registration"},400);
 }

 const rate=await consumeVehicleLookupRateLimit(request);
 if(!rate.allowed){
  return mobileJson(request,{ok:false,error:"rate_limited",retryAfterSeconds:Math.max(1,rate.retryAfterSeconds)},429);
 }

 try{
  const result=await lookupVehicleByRegistration(registration);
  if(result.status==="unavailable"){
   return mobileJson(request,{ok:false,error:"lookup_unavailable",message:result.message,registration:result.registration},503);
  }
  if(result.status==="not_found"){
   return mobileJson(request,{ok:false,error:"vehicle_not_found",message:result.message,registration:result.registration},404);
  }

  const catalogue=await matchRegistrationToCatalogue({
   make:result.vehicle.make,
   model:result.vehicle.model,
   year:result.vehicle.year,
   fuelType:result.vehicle.fuelType,
   engineSizeSimple:result.vehicle.engineSizeSimple
  });

  return mobileJson(request,{
   ok:true,
   registration:result.registration,
   vehicle:result.vehicle,
   catalogue,
   strategy:"dvsa_to_dft"
  });
 }catch{
  return mobileJson(request,{ok:false,error:"lookup_unavailable",registration},503);
 }
}
