import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RegistrationLookupResult,RegistrationVehicle } from "@/lib/vehicle-registration";

const digest=(value:string)=>createHash("sha256").update(value).digest("hex");

const vehicleFromJson=(value:unknown):RegistrationVehicle|null=>{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 const make=typeof row.make==="string"?row.make.trim():"";
 const model=typeof row.model==="string"?row.model.trim():"";
 if(!make||!model)return null;
 const numberOrUndefined=(input:unknown)=>{
  const parsed=typeof input==="number"?input:Number(input);
  return Number.isFinite(parsed)?Math.round(parsed):undefined;
 };
 const textOrUndefined=(input:unknown)=>typeof input==="string"&&input.trim()?input.trim():undefined;
 return {
  vehicleId:textOrUndefined(row.vehicleId),
  make,
  model,
  year:numberOrUndefined(row.year),
  engineSizeSimple:row.engineSizeSimple===null?null:numberOrUndefined(row.engineSizeSimple),
  fuelType:textOrUndefined(row.fuelType),
  colour:textOrUndefined(row.colour),
  firstUsedDate:textOrUndefined(row.firstUsedDate)
 };
};

const cacheHash=(registration:string,provider:string)=>digest("vehicle:"+provider+":"+registration);

export async function getCachedRegistrationLookup(registration:string,provider:string):Promise<RegistrationLookupResult|null>{
 try{
  const supabase=createSupabaseAdminClient();
  const hash=cacheHash(registration,provider);
  const {data,error}=await supabase
   .from("vehicle_lookup_cache")
   .select("result_status,vehicle,expires_at")
   .eq("lookup_hash",hash)
   .eq("provider",provider)
   .gt("expires_at",new Date().toISOString())
   .maybeSingle();
  if(error||!data)return null;
  if(data.result_status==="not_found"){
   return {status:"not_found",registration,message:"We could not find a vehicle for that registration."};
  }
  const vehicle=vehicleFromJson(data.vehicle);
  return vehicle?{status:"found",registration,vehicle}:null;
 }catch{
  return null;
 }
}

export async function storeRegistrationLookup(registration:string,provider:string,result:RegistrationLookupResult){
 if(result.status==="unavailable")return;
 try{
  const supabase=createSupabaseAdminClient();
  const now=Date.now();
  const ttlMs=result.status==="found"?24*60*60*1000:30*60*1000;
  await supabase.from("vehicle_lookup_cache").upsert({
   lookup_hash:cacheHash(registration,provider),
   provider,
   result_status:result.status,
   vehicle:result.status==="found"?result.vehicle:null,
   fetched_at:new Date(now).toISOString(),
   expires_at:new Date(now+ttlMs).toISOString()
  });
 }catch{
  // Cache is an optimisation only. Never fail the official lookup because cache storage failed.
 }
}

export type VehicleLookupRateLimit={
 allowed:boolean;
 remaining:number|null;
 retryAfterSeconds:number;
};

export async function consumeVehicleLookupRateLimit(request:Request):Promise<VehicleLookupRateLimit>{
 const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
 const ip=forwarded||request.headers.get("x-real-ip")?.trim()||request.headers.get("cf-connecting-ip")?.trim()||"unknown";
 const userAgent=request.headers.get("user-agent")?.slice(0,160)||"unknown";
 const keyHash=digest("vehicle-rate:"+ip+"|"+userAgent);

 try{
  const supabase=createSupabaseAdminClient();
  const {data,error}=await supabase.rpc("consume_vehicle_lookup_rate_limit",{
   p_key_hash:keyHash,
   p_limit:30,
   p_window_seconds:600
  });
  if(error)return {allowed:true,remaining:null,retryAfterSeconds:0};
  const row=data?.[0];
  if(!row)return {allowed:true,remaining:null,retryAfterSeconds:0};
  return {
   allowed:Boolean(row.allowed),
   remaining:Number(row.remaining??0),
   retryAfterSeconds:Number(row.retry_after_seconds??0)
  };
 }catch{
  return {allowed:true,remaining:null,retryAfterSeconds:0};
 }
}
