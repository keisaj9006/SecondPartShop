import { NextResponse } from "next/server";
import { matchRegistrationToCatalogue } from "@/lib/data/vehicle-catalogue";
import { isPlausibleUkRegistration,lookupVehicleByRegistration,normalizeRegistration } from "@/lib/vehicle-registration";

export const dynamic="force-dynamic";

export async function POST(request:Request){
 let body:unknown;
 try{body=await request.json();}catch{return NextResponse.json({message:"Send a registration in JSON."},{status:400,headers:{"cache-control":"no-store"}});}
 const registration=normalizeRegistration(typeof body==="object"&&body!==null&&"registration" in body?String((body as {registration?:unknown}).registration??""):"");
 if(!isPlausibleUkRegistration(registration))return NextResponse.json({message:"Enter a valid-looking UK registration."},{status:400,headers:{"cache-control":"no-store"}});
 const result=await lookupVehicleByRegistration(registration);
 if(result.status==="unavailable")return NextResponse.json({message:result.message,registration:result.registration},{status:503,headers:{"cache-control":"no-store"}});
 if(result.status==="not_found")return NextResponse.json({message:result.message,registration:result.registration},{status:404,headers:{"cache-control":"no-store"}});
 const catalogue=await matchRegistrationToCatalogue({
  make:result.vehicle.make,
  model:result.vehicle.model,
  year:result.vehicle.year,
  fuelType:result.vehicle.fuelType,
  engineSizeSimple:result.vehicle.engineSizeSimple
 });
 return NextResponse.json({
  registration:result.registration,
  vehicle:result.vehicle,
  catalogue,
  strategy:"dvsa_to_dft"
 },{status:200,headers:{"cache-control":"no-store"}});
}
