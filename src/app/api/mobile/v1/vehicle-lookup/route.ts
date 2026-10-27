import { createHash } from "node:crypto";
import { matchRegistrationToCatalogue } from "@/lib/data/vehicle-catalogue";
import { mobileJson,mobileOptions } from "@/lib/mobile-api";
import { isPlausibleUkRegistration,lookupVehicleByRegistration,normalizeRegistration } from "@/lib/vehicle-registration";
import { consumeVehicleLookupRateLimit } from "@/lib/vehicle-lookup-operational";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const logRouteFailure=(registration:string,code:"catalogue_error"|"other",stage:"catalogue"|"application")=>console.error("vehicle_lookup_failed",{
 code,
 stage,
 status:null,
 registration_hash:createHash("sha256").update(`vehicle-lookup:${registration}`).digest("hex")
});

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
 if(rate.status==="unavailable"){
  return mobileJson(request,{ok:false,error:"lookup_guard_unavailable",registration},503);
 }
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

  let catalogue;
  try{
   catalogue=await matchRegistrationToCatalogue({
    make:result.vehicle.make,
    model:result.vehicle.model,
    year:result.vehicle.year,
    fuelType:result.vehicle.fuelType,
    engineSizeSimple:result.vehicle.engineSizeSimple
   });
  }catch{
   logRouteFailure(registration,"catalogue_error","catalogue");
   return mobileJson(request,{ok:false,error:"lookup_unavailable",registration},503);
  }

  return mobileJson(request,{
   ok:true,
   registration:result.registration,
   vehicle:result.vehicle,
   catalogue,
   strategy:"dvsa_to_dft"
  });
 }catch{
  logRouteFailure(registration,"other","application");
  return mobileJson(request,{ok:false,error:"lookup_unavailable",registration},503);
 }
}
