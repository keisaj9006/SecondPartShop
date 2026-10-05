"use client";

import { useEffect,useRef } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { clearStoredVehicleContext,readStoredVehicleContext,resolveVehicleContext,VEHICLE_CONTEXT_STORAGE_KEY,type StoredVehicleContext } from "@/lib/vehicle-context";

export function VehicleContextPersistence({viewerId,garageContextValid=true}:{viewerId:string|null;garageContextValid?:boolean}){
 const pathname=usePathname();
 const router=useRouter();
 const searchParams=useSearchParams();
 const normalizedRef=useRef("");

 useEffect(()=>{
  if(pathname!=="/")return;
  const current=new URLSearchParams(searchParams.toString());
  let raw:string|null=null;
  try{raw=window.localStorage.getItem(VEHICLE_CONTEXT_STORAGE_KEY);}catch{}
  const stored=readStoredVehicleContext(raw,viewerId);
  const hasUrlGarage=current.has("gv");
  const resolved=resolveVehicleContext(current,{
   viewerId,
   stored,
   ...(hasUrlGarage?{garageValid:garageContextValid}:{}),
   addVehicleMode:current.get("addVehicle")==="1"
  });
  if(resolved.clearStored||(raw!==null&&!stored))clearStoredVehicleContext();
  if(resolved.needsReplace){
   const query=resolved.params.toString();
   const destination=query?`/?${query}#marketplace`:"/#marketplace";
   if(normalizedRef.current!==destination){normalizedRef.current=destination;router.replace(destination,{scroll:false});}
   return;
  }
  if(resolved.source==="url"&&resolved.selection.kind!=="none"&&resolved.selection.kind!=="invalid-garage"&&viewerId){
   const envelope:StoredVehicleContext={viewerId,selection:resolved.selection};
   try{window.localStorage.setItem(VEHICLE_CONTEXT_STORAGE_KEY,JSON.stringify(envelope));}catch{}
  }
  if(resolved.source==="storage"){
   const query=resolved.params.toString();
   const destination=query?`/?${query}#marketplace`:"/#marketplace";
   if(normalizedRef.current!==destination){normalizedRef.current=destination;router.replace(destination,{scroll:false});}
  }
 },[pathname,router,searchParams,viewerId,garageContextValid]);

 return null;
}
