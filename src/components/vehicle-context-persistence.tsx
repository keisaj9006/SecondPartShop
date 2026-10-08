"use client";

import { useEffect,useRef } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { clearStoredVehicleContext,readStoredVehicleContext,resolveVehicleContext,VEHICLE_CONTEXT_STORAGE_KEY,writeStoredVehicleContext } from "@/lib/vehicle-context";

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
  const canonicalQuery=resolved.params.toString();
  const canonicalDestination=canonicalQuery?`/?${canonicalQuery}#marketplace`:"/#marketplace";
  if(!resolved.needsReplace&&normalizedRef.current===canonicalDestination)normalizedRef.current="";
  if(resolved.clearStored||(raw!==null&&!stored))clearStoredVehicleContext();
  // Keep explicit vehicle errors on this URL until the buyer changes or clears them.
  // Dropping invalid context here would turn a fail-closed server result into broad browse.
  if(resolved.selection.kind==="invalid-garage"||(resolved.source==="url"&&resolved.selection.kind==="none"))return;
  if(resolved.needsReplace){
   if(normalizedRef.current!==canonicalDestination){normalizedRef.current=canonicalDestination;router.replace(canonicalDestination,{scroll:false});}
   return;
  }
  if(resolved.source==="url"&&resolved.selection.kind!=="none"&&viewerId){
   writeStoredVehicleContext(viewerId,resolved.selection);
  }
  if(resolved.source==="storage"){
   if(normalizedRef.current!==canonicalDestination){normalizedRef.current=canonicalDestination;router.replace(canonicalDestination,{scroll:false});}
  }
 },[pathname,router,searchParams,viewerId,garageContextValid]);

 return null;
}
