import "server-only";

import { createHash } from "node:crypto";
import { getCachedRegistrationLookup,storeRegistrationLookup } from "@/lib/vehicle-lookup-operational";

export type RegistrationVehicle={
 vehicleId?:string;
 make:string;
 model:string;
 year?:number;
 engineSizeSimple?:number|null;
 fuelType?:string;
 colour?:string;
 firstUsedDate?:string;
};
export type RegistrationLookupResult=
 | {status:"found";registration:string;vehicle:RegistrationVehicle}
 | {status:"not_found";registration:string;message:string}
 | {status:"unavailable";registration:string;message:string};

type TokenCache={accessToken:string;expiresAt:number};
let tokenCache:TokenCache|null=null;
let pendingToken:Promise<string>|null=null;

type VehicleLookupFailureCode=
 | "auth_missing" | "auth_401" | "auth_403"
 | "api_400" | "api_401" | "api_403" | "api_404" | "api_429" | "api_5xx"
 | "timeout" | "invalid_response" | "mapping_error" | "other";
type VehicleLookupStage="configuration"|"auth"|"api"|"response"|"mapping";

class VehicleLookupFailure extends Error{
 constructor(readonly code:VehicleLookupFailureCode,readonly stage:VehicleLookupStage,readonly status:number|null=null){super(code);}
}

const registrationHash=(registration:string)=>createHash("sha256").update(`vehicle-lookup:${registration}`).digest("hex");
const logLookupFailure=(registration:string,failure:VehicleLookupFailure)=>console.error("vehicle_lookup_failed",{
 code:failure.code,
 stage:failure.stage,
 status:failure.status,
 registration_hash:registrationHash(registration)
});
const failureForStatus=(prefix:"auth"|"api",status:number,stage:VehicleLookupStage)=>{
 if(status===401||status===403)return new VehicleLookupFailure(`${prefix}_${status}` as VehicleLookupFailureCode,stage,status);
 if(prefix==="api"&&status===400)return new VehicleLookupFailure("api_400",stage,status);
 if(prefix==="api"&&status===404)return new VehicleLookupFailure("api_404",stage,status);
 if(prefix==="api"&&status===429)return new VehicleLookupFailure("api_429",stage,status);
 if(prefix==="api"&&status>=500)return new VehicleLookupFailure("api_5xx",stage,status);
 return new VehicleLookupFailure("other",stage,status);
};

export const normalizeRegistration=(value:string)=>value.trim().toUpperCase().replace(/\s/g,"");
export function isPlausibleUkRegistration(value:string){const normalized=normalizeRegistration(value);return /^[A-Z0-9]{2,8}$/.test(normalized)&&/[A-Z]/.test(normalized)&&/[0-9]/.test(normalized);}

const stringValue=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():undefined;
const numberValue=(value:unknown)=>{if(typeof value!=="number"&&(typeof value!=="string"||!/^\d+$/.test(value)))return undefined;const parsed=Number(value);return Number.isFinite(parsed)?Math.round(parsed):undefined;};
const validDate=(value:unknown)=>{
 const text=stringValue(value);
 if(!text||!/^\d{4}-\d{2}-\d{2}$/.test(text))return undefined;
 const date=new Date(text);
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===text?text:undefined;
};
const yearFromDate=(value:unknown)=>{const text=validDate(value);if(!text)return undefined;const parsed=Number(text.slice(0,4));return parsed>=1900&&parsed<=2100?parsed:undefined;};

async function getDvsaAccessToken(){
 if(tokenCache&&tokenCache.expiresAt>Date.now())return tokenCache.accessToken;
 if(pendingToken)return pendingToken;
 pendingToken=acquireDvsaAccessToken();
 try{return await pendingToken;}finally{pendingToken=null;}
}

async function acquireDvsaAccessToken(){
 const clientId=process.env.DVSA_CLIENT_ID?.trim()||process.env.DVSA_MOT_CLIENT_ID?.trim();
 const clientSecret=process.env.DVSA_CLIENT_SECRET?.trim()||process.env.DVSA_MOT_CLIENT_SECRET?.trim();
 const scope=process.env.DVSA_SCOPE_URL?.trim()||process.env.DVSA_MOT_SCOPE?.trim();
 const tokenUrl=process.env.DVSA_TOKEN_URL?.trim()||process.env.DVSA_MOT_TOKEN_URL?.trim();
 if(!clientId||!clientSecret||!scope||!tokenUrl)throw new VehicleLookupFailure("auth_missing","configuration");
 const endpoint=new URL(tokenUrl);
 if(endpoint.protocol!=="https:"||endpoint.hostname!=="login.microsoftonline.com"||endpoint.username||endpoint.password)throw new VehicleLookupFailure("other","configuration");
 if(tokenCache&&tokenCache.expiresAt>Date.now())return tokenCache.accessToken;
 const body=new URLSearchParams({grant_type:"client_credentials",client_id:clientId,client_secret:clientSecret,scope});
 const response=await fetch(tokenUrl,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,cache:"no-store",signal:AbortSignal.timeout(8000),redirect:"error"});
 if(!response.ok)throw failureForStatus("auth",response.status,"auth");
 let payload:{access_token?:unknown;expires_in?:unknown};
 try{payload=await response.json() as {access_token?:unknown;expires_in?:unknown};}catch{throw new VehicleLookupFailure("invalid_response","auth",response.status);}
 const accessToken=stringValue(payload.access_token);
 if(!accessToken)throw new VehicleLookupFailure("invalid_response","auth",response.status);
 const expiresIn=numberValue(payload.expires_in);
 if(!expiresIn||expiresIn<=0)throw new VehicleLookupFailure("invalid_response","auth",response.status);
 tokenCache={accessToken,expiresAt:Date.now()+Math.max(0,expiresIn-Math.min(60,expiresIn/10))*1000};
 return accessToken;
}

async function lookupDvsaMot(registration:string):Promise<RegistrationLookupResult>{
 const apiKey=process.env.DVSA_API_KEY?.trim()||process.env.DVSA_MOT_API_KEY?.trim();
 if(!apiKey){
  logLookupFailure(registration,new VehicleLookupFailure("auth_missing","configuration"));
  return {status:"unavailable",registration,message:"Registration lookup is waiting for the DVSA API credentials."};
 }
 let stage:VehicleLookupStage="auth";
 let status:number|null=null;
 try{
  const accessToken=await getDvsaAccessToken();
  stage="api";
  const baseUrl=(process.env.DVSA_MOT_API_BASE_URL?.trim()||"https://history.mot.api.gov.uk").replace(/\/$/,"");
  if(baseUrl!=="https://history.mot.api.gov.uk")throw new VehicleLookupFailure("other","configuration");
  const response=await fetch(`${baseUrl}/v1/trade/vehicles/registration/${encodeURIComponent(registration)}`,{
   method:"GET",
   headers:{Authorization:`Bearer ${accessToken}`,"X-API-Key":apiKey,Accept:"application/json"},
   cache:"no-store",signal:AbortSignal.timeout(8000),redirect:"error"
  });
  status=response.status;
  if(response.status===404){logLookupFailure(registration,failureForStatus("api",response.status,"api"));return {status:"not_found",registration,message:"We could not find a vehicle for that registration."};}
  if(response.status===400){logLookupFailure(registration,failureForStatus("api",response.status,"api"));return {status:"not_found",registration,message:"The registration was not recognised by the DVSA vehicle service."};}
  if(!response.ok)throw failureForStatus("api",response.status,"api");
  stage="response";
  let raw:unknown;
  try{raw=await response.json() as unknown;}catch{throw new VehicleLookupFailure("invalid_response","response",response.status);}
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new VehicleLookupFailure("invalid_response","response",response.status);
  const record=raw as Record<string,unknown>;
  stage="mapping";
  if(typeof record.registration!=="string"||normalizeRegistration(record.registration)!==registration)throw new VehicleLookupFailure("mapping_error","mapping",response.status);
  const make=stringValue(record.make);
  const model=stringValue(record.model);
  if(!make||!model)throw new VehicleLookupFailure("mapping_error","mapping",response.status);
  const firstUsedDate=validDate(record.firstUsedDate)??validDate(record.registrationDate)??validDate(record.manufactureDate);
  const year=yearFromDate(record.manufactureDate)??yearFromDate(record.registrationDate)??yearFromDate(record.firstUsedDate);
  const engine=numberValue(record.engineSize);
  const engineSizeSimple=engine&&engine>=100&&engine<=10000?engine:null;
  return {
   status:"found",
   registration,
   vehicle:{
    make,
    model,
    year,
    engineSizeSimple,
    fuelType:stringValue(record.fuelType),
    colour:stringValue(record.primaryColour),
    firstUsedDate
   }
  };
 }catch(error){
  const errorName=error&&typeof error==="object"&&"name" in error?String(error.name):"";
  const failure=error instanceof VehicleLookupFailure
   ?error
   :new VehicleLookupFailure(errorName==="TimeoutError"||errorName==="AbortError"?"timeout":"other",stage,status);
  logLookupFailure(registration,failure);
  return {status:"unavailable",registration,message:"Registration lookup is configured but could not reach the official DVSA service. Please try again later."};
 }
}

export async function lookupVehicleByRegistration(rawRegistration:string):Promise<RegistrationLookupResult>{
 const registration=normalizeRegistration(rawRegistration);
 if(!isPlausibleUkRegistration(registration))return {status:"not_found",registration,message:"Check the registration and try again."};
 const provider=process.env.VEHICLE_LOOKUP_PROVIDER?.trim().toLowerCase()||((process.env.DVSA_CLIENT_ID?.trim()||process.env.DVSA_MOT_CLIENT_ID?.trim())?"dvsa_mot_history":"");
 if(!provider){
  logLookupFailure(registration,new VehicleLookupFailure("auth_missing","configuration"));
  return {status:"unavailable",registration,message:"Registration lookup is ready in SecondPart, but the official DVSA credentials have not been connected yet. You can still choose the vehicle manually."};
 }

 const cached=await getCachedRegistrationLookup(registration,provider);
 if(cached)return cached;

 let result:RegistrationLookupResult;
 if(provider==="dvsa_mot_history"||provider==="dvsa")result=await lookupDvsaMot(registration);
 else{
  logLookupFailure(registration,new VehicleLookupFailure("other","configuration"));
  result={status:"unavailable",registration,message:"The configured vehicle lookup provider is not supported by this build."};
 }

 await storeRegistrationLookup(registration,provider,result);
 return result;
}
