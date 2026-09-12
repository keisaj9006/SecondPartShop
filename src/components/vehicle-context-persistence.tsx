"use client";

import { useEffect,useRef } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { VEHICLE_CONTEXT_PARAMS,VEHICLE_CONTEXT_STORAGE_KEY } from "@/lib/vehicle-context";

export function VehicleContextPersistence(){
 const pathname=usePathname();
 const router=useRouter();
 const searchParams=useSearchParams();
 const restored=useRef(false);

 useEffect(()=>{
  if(pathname!=="/")return;
  const current=new URLSearchParams(searchParams.toString());
  if(current.get("cv")&&current.get("cy")){
   const saved:Record<string,string>={};
   for(const key of VEHICLE_CONTEXT_PARAMS){const value=current.get(key);if(value)saved[key]=value;}
   try{window.localStorage.setItem(VEHICLE_CONTEXT_STORAGE_KEY,JSON.stringify(saved));}catch{}
   restored.current=true;
   return;
  }
  if(restored.current||current.get("vehicle")||current.get("addVehicle")==="1")return;
  restored.current=true;
  try{
   const raw=window.localStorage.getItem(VEHICLE_CONTEXT_STORAGE_KEY);
   if(!raw)return;
   const saved=JSON.parse(raw) as Record<string,string>;
   if(!saved.cv||!saved.cy)return;
   for(const key of VEHICLE_CONTEXT_PARAMS){if(saved[key]&&!current.has(key))current.set(key,saved[key]);}
   const query=current.toString();
   router.replace(query?"/?"+query+"#marketplace":"/",{scroll:false});
  }catch{}
 },[pathname,router,searchParams]);

 return null;
}
