import "server-only";

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

export const normalizeRegistration=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
export function isPlausibleUkRegistration(value:string){const normalized=normalizeRegistration(value);return normalized.length>=2&&normalized.length<=8&&/[A-Z]/.test(normalized)&&/[0-9]/.test(normalized);}

const stringValue=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():undefined;
const numberValue=(value:unknown)=>{const parsed=typeof value==="number"?value:Number(value);return Number.isFinite(parsed)?Math.round(parsed):undefined;};
const yearFromDate=(value:unknown)=>{const text=stringValue(value);if(!text)return undefined;const parsed=Number(text.slice(0,4));return Number.isInteger(parsed)&&parsed>=1900&&parsed<=2100?parsed:undefined;};

async function getDvsaAccessToken(){
 const clientId=process.env.DVSA_MOT_CLIENT_ID?.trim();
 const clientSecret=process.env.DVSA_MOT_CLIENT_SECRET?.trim();
 const scope=process.env.DVSA_MOT_SCOPE?.trim();
 const tokenUrl=process.env.DVSA_MOT_TOKEN_URL?.trim();
 if(!clientId||!clientSecret||!scope||!tokenUrl)throw new Error("DVSA MOT API credentials are incomplete.");
 if(tokenCache&&tokenCache.expiresAt>Date.now()+5*60*1000)return tokenCache.accessToken;
 const body=new URLSearchParams({grant_type:"client_credentials",client_id:clientId,client_secret:clientSecret,scope});
 const response=await fetch(tokenUrl,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
 if(!response.ok)throw new Error("DVSA authentication failed.");
 const payload=await response.json() as {access_token?:unknown;expires_in?:unknown};
 const accessToken=stringValue(payload.access_token);
 if(!accessToken)throw new Error("DVSA authentication did not return an access token.");
 const expiresIn=Math.max(300,numberValue(payload.expires_in)??3600);
 tokenCache={accessToken,expiresAt:Date.now()+expiresIn*1000};
 return accessToken;
}

async function lookupDvsaMot(registration:string):Promise<RegistrationLookupResult>{
 const apiKey=process.env.DVSA_MOT_API_KEY?.trim();
 if(!apiKey)return {status:"unavailable",registration,message:"Registration lookup is waiting for the DVSA API credentials."};
 try{
  const accessToken=await getDvsaAccessToken();
  const baseUrl=(process.env.DVSA_MOT_API_BASE_URL?.trim()||"https://history.mot.api.gov.uk").replace(/\/$/,"");
  const response=await fetch(`${baseUrl}/v1/trade/vehicles/registration/${encodeURIComponent(registration)}`,{
   method:"GET",
   headers:{Authorization:`Bearer ${accessToken}`,"X-API-Key":apiKey,Accept:"application/json"},
   cache:"no-store"
  });
  if(response.status===404)return {status:"not_found",registration,message:"We could not find a vehicle for that registration."};
  if(response.status===400)return {status:"not_found",registration,message:"The registration was not recognised by the DVSA vehicle service."};
  if(!response.ok)return {status:"unavailable",registration,message:"The official vehicle lookup service is temporarily unavailable. Please try again or choose the vehicle manually."};
  const raw=await response.json() as unknown;
  const record=(Array.isArray(raw)?raw[0]:raw) as Record<string,unknown>|undefined;
  if(!record)return {status:"not_found",registration,message:"No vehicle details were returned for that registration."};
  const make=stringValue(record.make);
  const model=stringValue(record.model);
  if(!make||!model)return {status:"not_found",registration,message:"The vehicle was found, but make/model details were unavailable."};
  const firstUsedDate=stringValue(record.firstUsedDate)??stringValue(record.registrationDate)??stringValue(record.manufactureDate);
  const year=yearFromDate(firstUsedDate)??numberValue(record.yearOfManufacture);
  const engineSizeSimple=numberValue(record.engineSize)??numberValue(record.engineCapacity)??null;
  return {
   status:"found",
   registration,
   vehicle:{
    make,
    model,
    year,
    engineSizeSimple,
    fuelType:stringValue(record.fuelType),
    colour:stringValue(record.primaryColour)??stringValue(record.colour),
    firstUsedDate
   }
  };
 }catch{
  return {status:"unavailable",registration,message:"Registration lookup is configured but could not reach the official DVSA service. Please try again later."};
 }
}

export async function lookupVehicleByRegistration(rawRegistration:string):Promise<RegistrationLookupResult>{
 const registration=normalizeRegistration(rawRegistration);
 const provider=process.env.VEHICLE_LOOKUP_PROVIDER?.trim().toLowerCase();
 if(!provider)return {status:"unavailable",registration,message:"Registration lookup is ready in SecondPart, but the official DVSA credentials have not been connected yet. You can still choose the vehicle manually."};
 if(provider==="dvsa_mot_history"||provider==="dvsa")return lookupDvsaMot(registration);
 return {status:"unavailable",registration,message:"The configured vehicle lookup provider is not supported by this build."};
}
