import "server-only";

export type RegistrationVehicle={vehicleId?:string;make:string;model:string;generation?:string;year?:number;engine?:string;fuelType?:string};
export type RegistrationLookupResult=
 | {status:"found";registration:string;vehicle:RegistrationVehicle}
 | {status:"not_found";registration:string;message:string}
 | {status:"unavailable";registration:string;message:string};

export const normalizeRegistration=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
export function isPlausibleUkRegistration(value:string){const normalized=normalizeRegistration(value);return normalized.length>=2&&normalized.length<=8&&/[A-Z]/.test(normalized)&&/[0-9]/.test(normalized);}

export async function lookupVehicleByRegistration(rawRegistration:string):Promise<RegistrationLookupResult>{
 const registration=normalizeRegistration(rawRegistration);
 const provider=process.env.VEHICLE_LOOKUP_PROVIDER?.trim();
 if(!provider)return {status:"unavailable",registration,message:"Registration lookup is not connected to a verified UK vehicle-data provider yet. Please choose your vehicle manually."};
 return {status:"unavailable",registration,message:`Vehicle lookup provider "${provider}" is configured but no approved provider adapter has been enabled in this build. Please choose your vehicle manually.`};
}
