"use client";

import Link from "next/link";
import { useCallback,useEffect,useState,useSyncExternalStore } from "react";
import { CarFront } from "lucide-react";
import type { GarageVehicle } from "@/lib/types";
import { GarageVehicleRemoveForm } from "@/components/garage-vehicle-remove-form";
import { GarageVehicleUseControl } from "@/components/garage-vehicle-use-control";
import { VehicleVisual } from "@/components/vehicle-visual";
import { clearStoredVehicleContext,EMPTY_VEHICLE_CONTEXT_SNAPSHOT,getStoredVehicleContextSnapshot,readStoredVehicleContext,setVehicleContext,subscribeVehicleContext,writeStoredVehicleContext,type StoredVehicleContext } from "@/lib/vehicle-context";

type Selection=StoredVehicleContext["selection"]|null;

const vehicleHref=(vehicleId:string)=>{
 const params=setVehicleContext(new URLSearchParams(),{kind:"garage",garageVehicleId:vehicleId,fitOnly:true});
 return `/?${params.toString()}#marketplace`;
};

export function GarageVehicleList({vehicles,viewerId,initialSelection}:{vehicles:GarageVehicle[];viewerId:string;initialSelection?:Selection}){
 const [localSelection,setLocalSelection]=useState<{viewerId:string;initialSelection:Selection|undefined;selection:Selection|undefined}>(()=>({viewerId,initialSelection,selection:initialSelection}));
 const subscribe=useCallback((listener:()=>void)=>subscribeVehicleContext(()=>{
  setLocalSelection({viewerId,initialSelection,selection:undefined});
  listener();
 }),[viewerId,initialSelection]);
 const storedSnapshot=useSyncExternalStore(subscribe,getStoredVehicleContextSnapshot,()=>"");
 const stored=storedSnapshot===EMPTY_VEHICLE_CONTEXT_SNAPSHOT?null:readStoredVehicleContext(storedSnapshot,viewerId);
 const fallback=localSelection.viewerId===viewerId&&localSelection.initialSelection===initialSelection?localSelection.selection:initialSelection;
 const selection=fallback!==undefined?fallback:stored?.selection??null;
 const selectionReady=initialSelection!==undefined||storedSnapshot!=="";

 useEffect(()=>{
  if(initialSelection===undefined)return;
  if(initialSelection){
   writeStoredVehicleContext(viewerId,initialSelection);
  }else{
   clearStoredVehicleContext();
  }
 },[initialSelection,viewerId]);

 const persist=(next:Selection)=>{
  setLocalSelection({viewerId,initialSelection,selection:next});
  if(next)writeStoredVehicleContext(viewerId,next);
  else clearStoredVehicleContext();
 };
 const clearVehicle=()=>persist(null);
 const currentGarageId=selection?.kind==="garage"?selection.garageVehicleId:null;
 const fitOnly=selection?.fitOnly!==false;

 return <>
  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-[#f8f7f2] p-4">
   <p className="text-sm font-bold text-[#53615b]">Saved vehicles stay in your Garage when you switch or browse without one.</p>
   <Link href="/#marketplace" onClick={clearVehicle} className="rounded-full border border-black/20 bg-white px-4 py-2.5 text-sm font-black text-[#173c31]">Browse without a vehicle</Link>
  </div>
  {vehicles.length?<div className="mt-4 grid gap-4 md:grid-cols-2">{vehicles.map(vehicle=>{
   const isCurrent=selectionReady&&currentGarageId===vehicle.id;
   const href=vehicleHref(vehicle.id);
   const updateFit=(enabled:boolean)=>{
    if(selection?.kind==="garage"&&selection.garageVehicleId===vehicle.id)persist({...selection,fitOnly:enabled});
   };
   const activate=()=>persist({kind:"garage",garageVehicleId:vehicle.id,fitOnly:true});
   return <article key={vehicle.id} className={`min-w-0 rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${isCurrent?"border-[#287154] ring-2 ring-[#d4f44d]/70":"border-black/10"}`}>
    <VehicleVisual make={vehicle.make} model={vehicle.modelFamily} year={vehicle.year} colour={vehicle.colour} variant={vehicle.variant??undefined} registration={vehicle.registration??undefined} engine={vehicle.engineSizeSimple?vehicle.engineSizeSimple+"cc":null} fuel={vehicle.fuelType??undefined}/>
    <div className="mt-4 flex min-w-0 items-start justify-between gap-3">
     <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><CarFront size={21}/></span><div className="min-w-0">{vehicle.registration&&<p className="text-xs font-black uppercase tracking-[.14em] text-[#287154]">{vehicle.registration}</p>}<h2 className="mt-1 break-words text-lg font-black sm:text-xl">{vehicle.make} {vehicle.modelFamily}</h2><p className="mt-1 break-words text-sm text-[#63706a]">{vehicle.year}{vehicle.variant?` · ${vehicle.variant}`:" · Exact version not selected"}{vehicle.engineSizeSimple?` · ${vehicle.engineSizeSimple}cc`:""}{vehicle.fuelType?` · ${vehicle.fuelType}`:""}</p>{vehicle.nickname&&<p className="mt-2 text-sm font-bold">{vehicle.nickname}</p>}</div></div>
     <GarageVehicleRemoveForm garageVehicleId={vehicle.id} viewerId={viewerId} label={`Remove ${vehicle.make} ${vehicle.modelFamily} from Garage`}/>
    </div>
    {selectionReady?<GarageVehicleUseControl isCurrent={isCurrent} fitOnly={fitOnly} fitHref={href} onFitChange={updateFit} onUse={activate}/>:<p className="mt-5 min-h-12 rounded-xl bg-[#f8f7f2] p-3 text-sm font-bold text-[#63706a]" role="status">Checking current vehicle…</p>}
   </article>;
  })}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><CarFront className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">Your Garage is empty</h2><p className="mx-auto mt-2 max-w-lg text-[#63706a]">Select a vehicle on the marketplace and save it here for faster future searches.</p><Link href="/?addVehicle=1#vehicle-picker" className="mt-5 inline-block rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Find my vehicle</Link></div>}
 </>;
}
