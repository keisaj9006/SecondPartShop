import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const {data,error}=await supabase
  .from("fitting_requests")
  .select("id,part_id,garage_partner_id,vehicle_variant_id,vehicle_year,vehicle_fuel,vehicle_engine_size,vehicle_registration,buyer_notes,status,quote_pence,quote_note,quoted_at,created_at,parts(title,slug),garage_partners(business_name,slug,location),vehicle_catalogue_variants(make,model_family,variant)")
  .eq("buyer_id",user.id)
  .order("created_at",{ascending:false})
  .limit(60);
 if(error)return mobileJson(request,{ok:false,error:"fitting_requests_unavailable"},503);
 const items=(data??[]).flatMap(row=>{
  const part=one(row.parts),garage=one(row.garage_partners),vehicle=one(row.vehicle_catalogue_variants);
  if(!part||!garage||!vehicle)return [];
  return [{
   id:row.id,partId:row.part_id,partTitle:part.title,partSlug:part.slug,
   garagePartnerId:row.garage_partner_id,garageName:garage.business_name,garageSlug:garage.slug,garageLocation:garage.location,
   vehicleVariantId:row.vehicle_variant_id,vehicleMake:vehicle.make,vehicleModel:vehicle.model_family,vehicleVariant:vehicle.variant,
   vehicleYear:row.vehicle_year,vehicleFuel:row.vehicle_fuel,vehicleEngineSize:row.vehicle_engine_size,
   vehicleRegistration:row.vehicle_registration,buyerNotes:row.buyer_notes,status:row.status,
   quotePence:row.quote_pence,quoteNote:row.quote_note,quotedAt:row.quoted_at,createdAt:row.created_at
  }];
 });
 return mobileJson(request,{ok:true,items});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;
 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 const partId=String(input.partId??"");
 const garagePartnerId=String(input.garagePartnerId??"");
 const vehicle=input.vehicle&&typeof input.vehicle==="object"&&!Array.isArray(input.vehicle)?input.vehicle as Record<string,unknown>:{};
 const variantId=String(vehicle.variantId??"");
 const year=Number(vehicle.year);
 const fuel=String(vehicle.fuelType??"").trim();
 const engineRaw=vehicle.engineSizeSimple;
 const engine=engineRaw===null||engineRaw===undefined||engineRaw===""?undefined:Number(engineRaw);
 const registration=String(vehicle.registration??"").trim();
 const notes=String(input.notes??"").trim().slice(0,1000);
 if(!isUuid(partId)||!isUuid(garagePartnerId)||!isUuid(variantId)||!Number.isInteger(year)||engine!==undefined&&!Number.isInteger(engine)){
  return mobileJson(request,{ok:false,error:"invalid_fitting_request"},400);
 }
 const {data,error}=await supabase.rpc("request_part_fitting_quote",{
  p_part_id:partId,p_garage_partner_id:garagePartnerId,p_vehicle_variant_id:variantId,p_vehicle_year:year,
  p_vehicle_fuel:fuel||undefined,p_vehicle_engine:engine,p_vehicle_registration:registration||undefined,p_notes:notes||undefined
 });
 if(error){
  const message=error.message.toLowerCase();
  if(message.includes("already open"))return mobileJson(request,{ok:false,error:"duplicate_fitting_request"},409);
  if(message.includes("too many"))return mobileJson(request,{ok:false,error:"fitting_request_limit"},429);
  return mobileJson(request,{ok:false,error:"fitting_request_failed"},409);
 }
 return mobileJson(request,{ok:true,id:data},201);
}
