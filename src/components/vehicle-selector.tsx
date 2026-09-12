"use client";

import { useEffect,useId,useRef,useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { CarFront,ChevronDown,Search,X } from "lucide-react";
import { VehicleVisual } from "@/components/vehicle-visual";
import { clearStoredVehicleContext } from "@/lib/vehicle-context";
import type { Vehicle,VehicleCatalogueSelection } from "@/lib/types";

type LookupState={kind:"idle"|"loading"|"error"|"info";message?:string};
type CatalogueVariantOption={id:string;variant:string};
type CatalogueEngine={fuelType:string;engineSizeSimple:number|null;engineSizeDesc:string|null};
type ApiPayload<T>={items?:T[];message?:string};
type RegistrationSummary={
 registration:string;
 make:string;
 model:string;
 year?:number;
 engineSizeSimple?:number|null;
 fuelType?:string;
 colour?:string;
 firstUsedDate?:string;
 catalogue?:{
  make:string|null;
  modelFamily:string|null;
  variants:CatalogueVariantOption[];
  engineMatched?:boolean;
 };
};

const nameLabel=(value:string)=>value.toLowerCase().replace(/(^|[\s/-])\p{L}/gu,match=>match.toUpperCase()).replace(/\bBmw\b/g,"BMW").replace(/\bMg\b/g,"MG").replace(/\bDs\b/g,"DS");
const fuelLabel=(value:string)=>value.toLowerCase().replace(/(^|[\s(-])\p{L}/gu,match=>match.toUpperCase());
const engineKey=(engine:Pick<CatalogueEngine,"fuelType"|"engineSizeSimple">)=>`${engine.fuelType}\u001f${engine.engineSizeSimple??""}`;
const catalogueCache=new Map<string,unknown[]>();

async function getItems<T>(url:string,signal?:AbortSignal):Promise<T[]>{
 const cached=catalogueCache.get(url);if(cached)return cached as T[];
 const controller=new AbortController();
 let timedOut=false;
 const abort=()=>controller.abort();
 signal?.addEventListener("abort",abort,{once:true});
 const timer=window.setTimeout(()=>{timedOut=true;controller.abort();},8000);
 try{
  const response=await fetch(url,{signal:controller.signal});
  const payload=await response.json() as ApiPayload<T>;
  if(!response.ok)throw new Error(payload.message??"Vehicle catalogue is unavailable.");
  const items=payload.items??[];catalogueCache.set(url,items as unknown[]);return items;
 }catch(error){
  if(timedOut)throw new Error("Vehicle options are taking too long to load. Please try again.");
  throw error;
 }finally{
  window.clearTimeout(timer);
  signal?.removeEventListener("abort",abort);
 }
}

export function SearchableVehicleSelect({value,options,placeholder,label,disabled,onChange}:{value:string;options:{value:string;label:string}[];placeholder:string;label:string;disabled?:boolean;onChange:(value:string)=>void}){
 const instanceId=useId();
 const listboxRef=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false);
 const [term,setTerm]=useState("");
 const [activeValue,setActiveValue]=useState<string|null>(null);
 const selectedLabel=options.find(option=>option.value===value)?.label??"";
 const listboxId=`vehicle-select-${instanceId}`;
 const optionId=(optionValue:string)=>`${listboxId}-option-${Array.from(optionValue).map(character=>character.codePointAt(0)?.toString(16)).join("-")||"empty"}`;
 const normalized=term.trim().toLowerCase();
 const filtered=(normalized?options.filter(option=>option.label.toLowerCase().includes(normalized)):options).slice(0,80);
 // Discard intent when an option becomes unavailable; a later reload must not revive it.
 if(activeValue!==null&&(disabled||!filtered.some(option=>option.value===activeValue)))setActiveValue(null);
 const activeOption=!disabled&&open?filtered.find(option=>option.value===activeValue):undefined;
 const activeId=activeOption?optionId(activeOption.value):undefined;
 const close=()=>{setOpen(false);setTerm("");setActiveValue(null);};
 const choose=(next:string)=>{if(!disabled&&filtered.some(option=>option.value===next)){onChange(next);close();}};
 const moveActive=(direction:1|-1)=>{
  setOpen(true);
  setActiveValue(current=>{
   if(!filtered.length)return null;
   const currentIndex=filtered.findIndex(option=>option.value===current);
   if(currentIndex<0)return filtered[direction===1?0:filtered.length-1].value;
   return filtered[Math.max(0,Math.min(filtered.length-1,currentIndex+direction))].value;
  });
 };

 useEffect(()=>{
  if(!activeId)return;
  const listbox=listboxRef.current;
  const option=document.getElementById(activeId);
  if(!listbox||!option)return;
  const listboxBounds=listbox.getBoundingClientRect();
  const optionBounds=option.getBoundingClientRect();
  if(optionBounds.top<listboxBounds.top||optionBounds.bottom>listboxBounds.bottom)option.scrollIntoView({block:"nearest",behavior:"auto"});
 },[activeId]);

 return <div className="relative min-w-0" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))close();}}>
  <input role="combobox" aria-label={label} aria-controls={filtered.length?listboxId:undefined} aria-expanded={open&&!disabled&&filtered.length>0} aria-describedby={open&&!disabled&&!filtered.length?`${listboxId}-status`:undefined} aria-activedescendant={activeId} aria-autocomplete="list" disabled={disabled} value={open&&!disabled?term:selectedLabel} onFocus={()=>{if(!disabled){setOpen(true);setTerm("");setActiveValue(null);}}} onChange={event=>{setTerm(event.target.value);setOpen(true);setActiveValue(null);}} onKeyDown={event=>{
   if(event.key==="ArrowDown"&&!disabled){event.preventDefault();moveActive(1);}
   else if(event.key==="ArrowUp"&&!disabled){event.preventDefault();moveActive(-1);}
   else if(event.key==="Enter"&&open&&!disabled){event.preventDefault();if(activeOption)choose(activeOption.value);}
   else if(event.key==="Escape"&&open){event.preventDefault();close();}
   else if(event.key==="Tab"&&open)close();
  }} className="w-full rounded-xl border border-black/12 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31] disabled:bg-black/5" placeholder={placeholder}/>
  {open&&!disabled&&(filtered.length?<div ref={listboxRef} id={listboxId} role="listbox" aria-label={label} className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-black/10 bg-white p-1 shadow-xl">{filtered.map(option=><button key={option.value} id={optionId(option.value)} type="button" role="option" tabIndex={-1} aria-selected={option.value===value} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option.value)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${option.value===activeOption?.value?"bg-[#eef1eb]":"hover:bg-[#eef1eb]"}`}>{option.label}</button>)}</div>:<p id={`${listboxId}-status`} role="status" className="absolute z-30 mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-[#63706a] shadow-xl">No matching options</p>)}
 </div>;
}

export function VehicleSelector({vehicles,selectedId,selectedCatalogue,baseParams,compatibleOnly,freshSelection=false}:{vehicles:Vehicle[];selectedId?:string;selectedCatalogue:VehicleCatalogueSelection|null;baseParams:Record<string,string>;compatibleOnly:boolean;freshSelection?:boolean}){
 const activeCatalogue=freshSelection?null:selectedCatalogue;
 const selectedLegacy=freshSelection?undefined:vehicles.find(vehicle=>vehicle.id===selectedId);
 const router=useRouter();
 const [isApplying,startTransition]=useTransition();

 const [registration,setRegistration]=useState("");
 const [fitOnly,setFitOnly]=useState(compatibleOnly);
 const [lookup,setLookup]=useState<LookupState>({kind:"idle"});
 const [registrationVehicle,setRegistrationVehicle]=useState<RegistrationSummary|null>(null);
 const [manualOpen,setManualOpen]=useState(Boolean(activeCatalogue||selectedLegacy));

 const [makes,setMakes]=useState<string[]>(activeCatalogue?.make?[activeCatalogue.make]:[]);
 const [models,setModels]=useState<string[]>(activeCatalogue?.modelFamily?[activeCatalogue.modelFamily]:[]);
 const [loadingMakes,setLoadingMakes]=useState(Boolean(activeCatalogue||selectedLegacy));
 const [loadingModels,setLoadingModels]=useState(Boolean(activeCatalogue?.make));
 const [make,setMake]=useState(activeCatalogue?.make??"");
 const [model,setModel]=useState(activeCatalogue?.modelFamily??"");
 const [year,setYear]=useState(activeCatalogue?String(activeCatalogue.year):"");
 const [variantId,setVariantId]=useState(activeCatalogue?.variantId??"");
 const [catalogueEngine,setCatalogueEngine]=useState(activeCatalogue?.fuelType?engineKey({fuelType:activeCatalogue.fuelType,engineSizeSimple:activeCatalogue.engineSizeSimple}):"");
 const [years,setYears]=useState<number[]>([]);
 const [variants,setVariants]=useState<CatalogueVariantOption[]>([]);
 const [engines,setEngines]=useState<CatalogueEngine[]>([]);
 const [loadingYears,setLoadingYears]=useState(Boolean(activeCatalogue?.modelFamily));
 const [loadingVariants,setLoadingVariants]=useState(Boolean(activeCatalogue?.year));
 const [loadingEngines,setLoadingEngines]=useState(Boolean(activeCatalogue?.variantId));
 const [catalogueError,setCatalogueError]=useState("");


 useEffect(()=>{
  if(!manualOpen)return;
  const controller=new AbortController();
  void getItems<string>("/api/vehicle-catalogue?level=makes",controller.signal)
   .then(items=>{setMakes(items);setLoadingMakes(false);})
   .catch(error=>{if(error instanceof Error&&error.name!=="AbortError"){setCatalogueError(error.message);setLoadingMakes(false);}});
  return()=>controller.abort();
 },[manualOpen]);

 useEffect(()=>{
  if(!manualOpen||!make)return;
  const controller=new AbortController();
  void getItems<string>(`/api/vehicle-catalogue?level=models&make=${encodeURIComponent(make)}`,controller.signal)
   .then(items=>{setModels(items);setLoadingModels(false);})
   .catch(error=>{if(error instanceof Error&&error.name!=="AbortError"){setCatalogueError(error.message);setLoadingModels(false);}});
  return()=>controller.abort();
 },[manualOpen,make]);

 useEffect(()=>{
  if(!make||!model)return;
  const controller=new AbortController();
  void getItems<number>(`/api/vehicle-catalogue?level=years-model&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,controller.signal)
   .then(items=>{setYears(items);setLoadingYears(false);})
   .catch(error=>{if(error instanceof Error&&error.name!=="AbortError"){setCatalogueError(error.message);setLoadingYears(false);}});
  return()=>controller.abort();
 },[make,model]);

 useEffect(()=>{
  if(!make||!model||!year)return;
  const controller=new AbortController();
  void getItems<CatalogueVariantOption>(`/api/vehicle-catalogue?level=variants-year&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`,controller.signal)
   .then(items=>{setVariants(items);setLoadingVariants(false);})
   .catch(error=>{if(error instanceof Error&&error.name!=="AbortError"){setCatalogueError(error.message);setLoadingVariants(false);}});
  return()=>controller.abort();
 },[make,model,year]);

 useEffect(()=>{
  if(!variantId)return;
  const controller=new AbortController();
  void getItems<CatalogueEngine>(`/api/vehicle-catalogue?level=engines&variantId=${encodeURIComponent(variantId)}`,controller.signal)
   .then(items=>{
    setEngines(items);
    const matched=items.length===1?items[0]:registrationVehicle?.catalogue?.engineMatched&&registrationVehicle.fuelType&&registrationVehicle.engineSizeSimple!=null
     ?items.find(item=>item.fuelType.toLowerCase()===registrationVehicle.fuelType?.toLowerCase()&&item.engineSizeSimple===registrationVehicle.engineSizeSimple)
     :undefined;
    if(matched)setCatalogueEngine(engineKey(matched));
    else if(items.length>1&&registrationVehicle){
     setManualOpen(true);
     setLookup({kind:"info",message:"Vehicle found. Choose the engine and fuel below to continue."});
    }
    setLoadingEngines(false);
   })
   .catch(error=>{if(error instanceof Error&&error.name!=="AbortError"){setCatalogueError(error.message);setLoadingEngines(false);}});
  return()=>controller.abort();
 },[variantId,registrationVehicle]);

 const pushVehicleParams=(params:URLSearchParams)=>{
  for(const key of ["vehicle","cv","cy","cf","ce","vr","vc"])params.delete(key);
  const qs=params.toString();
  router.push(`/${qs?`?${qs}`:""}#marketplace`);
 };

 const clearVehicle=()=>{
  clearStoredVehicleContext();
  const params=new URLSearchParams(baseParams);
  pushVehicleParams(params);
 };

 const applyCatalogue=()=>{
  if(!variantId||!year)return;
  const params=new URLSearchParams(baseParams);
  params.set("cv",variantId);
  params.set("cy",year);
  const engine=engines.find(item=>engineKey(item)===catalogueEngine);
  if(engine){
   params.set("cf",engine.fuelType);
   if(engine.engineSizeSimple!==null)params.set("ce",String(engine.engineSizeSimple));
  }
  params.delete("vehicle");
  params.set("fit",fitOnly?"1":"0");
  if(registrationVehicle?.registration)params.set("vr",registrationVehicle.registration);else params.delete("vr");
  if(registrationVehicle?.colour)params.set("vc",registrationVehicle.colour);else params.delete("vc");
  const qs=params.toString();
  startTransition(()=>router.push(`/?${qs}#marketplace`));
 };

 const findByRegistration=async()=>{
  const value=registration.trim();
  if(!value){setLookup({kind:"error",message:"Enter a UK registration first."});return;}
  setLookup({kind:"loading",message:"Looking up vehicle…"});
  setRegistrationVehicle(null);
  try{
   const response=await fetch("/api/vehicle-lookup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({registration:value}),cache:"no-store"});
   const payload=await response.json() as {message?:string;registration?:string;vehicle?:Omit<RegistrationSummary,"registration"|"catalogue">;catalogue?:RegistrationSummary["catalogue"]};
   if(!response.ok){
    setLookup({kind:response.status===503?"info":"error",message:response.status===503?"Registration lookup is unavailable right now. Select your vehicle manually below.":payload.message??"We could not look up that registration. Check it and try again, or select your vehicle manually below."});
    setManualOpen(true);
    return;
   }
   if(!payload.vehicle||!payload.registration){
    setLookup({kind:"error",message:"The vehicle details returned were incomplete."});
    setManualOpen(true);
    return;
   }
   const summary:RegistrationSummary={...payload.vehicle,registration:payload.registration,catalogue:payload.catalogue};
   setRegistrationVehicle(summary);
   const catalogue=payload.catalogue;
   if(catalogue?.make&&catalogue.modelFamily&&payload.vehicle.year){
    setMake(catalogue.make);
    setModel(catalogue.modelFamily);
    setYear(String(payload.vehicle.year));
    setYears([]);
    setVariants(catalogue.variants??[]);
    setEngines([]);
    setCatalogueEngine("");
    if(catalogue.variants?.length===1){
     const only=catalogue.variants[0];
     setLoadingEngines(true);
     setVariantId(only.id);
     setLookup({kind:"info",message:"Vehicle found. Confirm how you want to use it below."});
     return;
    }
    setVariantId("");
    setManualOpen(true);
    setLookup({kind:"info",message:catalogue.variants?.length?"Vehicle found. Choose the exact version below to continue.":"Vehicle found. Select the closest version manually to continue."});
    return;
   }
   setManualOpen(true);
   setLookup({kind:"info",message:"Vehicle found. Review the details and complete the manual selection below."});
  }catch{
   setLookup({kind:"error",message:"Vehicle lookup could not be reached. Select the vehicle manually below."});
   setManualOpen(true);
  }
 };

 const resetAfterMake=(value:string)=>{setMake(value);setModel("");setModels([]);setYear("");setVariantId("");setCatalogueEngine("");setYears([]);setVariants([]);setEngines([]);setLoadingModels(Boolean(value));setLoadingYears(false);setLoadingVariants(false);setLoadingEngines(false);setCatalogueError("");};
 const resetAfterModel=(value:string)=>{setModel(value);setYear("");setVariantId("");setCatalogueEngine("");setYears([]);setVariants([]);setEngines([]);setLoadingYears(Boolean(value));setLoadingVariants(false);setLoadingEngines(false);setCatalogueError("");};
 const resetAfterYear=(value:string)=>{setYear(value);setVariantId("");setCatalogueEngine("");setVariants([]);setEngines([]);setLoadingVariants(Boolean(value));setLoadingEngines(false);setCatalogueError("");};
 const resetAfterVariant=(value:string)=>{setVariantId(value);setCatalogueEngine("");setEngines([]);setLoadingEngines(Boolean(value));setCatalogueError("");};

 const control="min-w-0 rounded-xl border border-black/12 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31] disabled:bg-black/5";
 const selectedVariant=variants.find(item=>item.id===variantId)??(activeCatalogue?.variantId===variantId?{id:activeCatalogue.variantId,variant:activeCatalogue.variant}:undefined);
 const canApply=Boolean(variantId&&year&&!loadingVariants&&!loadingEngines&&(engines.length===0||catalogueEngine)&&!isApplying);

 return <div>
  <div className="rounded-2xl border border-black/10 bg-white p-4">
   <label className="text-xs font-black uppercase tracking-[.14em] text-[#287154]" htmlFor="registration">Find your vehicle</label>
   <div className="mt-2 flex flex-col gap-2 sm:flex-row">
    <input id="registration" value={registration} onChange={event=>setRegistration(event.target.value.toUpperCase())} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void findByRegistration();}}} maxLength={10} autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-black/15 bg-[#f8f7f2] px-4 py-3 font-mono text-base font-bold uppercase tracking-[.12em] outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="AB12 CDE"/>
    <button type="button" onClick={()=>void findByRegistration()} disabled={lookup.kind==="loading"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-60"><Search size={16}/>{lookup.kind==="loading"?"Checking…":"Find my vehicle"}</button>
   </div>
   <p className="mt-2 text-xs leading-5 text-[#63706a]">Enter a UK registration to look up your vehicle. If lookup is unavailable or the details are unclear, select your vehicle manually below.</p>
   {lookup.message&&<p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${lookup.kind==="error"?"bg-red-50 text-red-800":"bg-[#eef1eb] text-[#173c31]"}`}>{lookup.message}</p>}
   {registrationVehicle&&<div className="mt-3 grid gap-3 rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,.9fr)] md:items-center"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173c31] text-white"><CarFront size={19}/></span><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.12em] text-[#287154]">{registrationVehicle.registration}</p><p className="mt-1 text-lg font-black">{nameLabel(registrationVehicle.make)} {nameLabel(registrationVehicle.model)}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#4f5e57]">{registrationVehicle.year&&<span>Year: <strong>{registrationVehicle.year}</strong></span>}{registrationVehicle.engineSizeSimple&&<span>Engine: <strong>{registrationVehicle.engineSizeSimple}cc</strong></span>}{registrationVehicle.fuelType&&<span>Fuel: <strong>{fuelLabel(registrationVehicle.fuelType)}</strong></span>}{registrationVehicle.colour&&<span>Colour: <strong>{nameLabel(registrationVehicle.colour)}</strong></span>}</div></div></div>{registrationVehicle.year&&<VehicleVisual make={nameLabel(registrationVehicle.make)} model={nameLabel(registrationVehicle.model)} year={registrationVehicle.year} colour={registrationVehicle.colour} registration={registrationVehicle.registration} engine={registrationVehicle.engineSizeSimple?registrationVehicle.engineSizeSimple+"cc":null} fuel={registrationVehicle.fuelType?fuelLabel(registrationVehicle.fuelType):null} compact/>}</div>}
   {!activeCatalogue&&!selectedLegacy&&<label className={`mt-3 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${fitOnly?"border-[#173c31] bg-[#f7faef] ring-2 ring-[#d4f44d]/50":"border-black/10 bg-white"}`}>
    <input type="checkbox" checked={fitOnly} onChange={event=>setFitOnly(event.target.checked)} className="mt-1 h-5 w-5 accent-[#173c31]"/>
    <span><strong className="block text-sm text-[#173c31]">Show only parts that fit this vehicle</strong><small className="mt-1 block leading-5 text-[#63706a]">{freshSelection?"Choose this before adding the new vehicle. The previous vehicle is not used here.":"Recommended: keep this on to show compatibility-filtered results as soon as you select a vehicle."}</small></span>
   </label>}
   {registrationVehicle&&variantId&&year&&<div className="mt-3 rounded-2xl border border-[#173c31]/15 bg-white p-4"><button type="button" disabled={!canApply} onClick={applyCatalogue} className="w-full rounded-xl bg-[#d4f44d] px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">{isApplying?"Applying vehicle…":"Use this vehicle"}</button></div>}
  </div>

  <button type="button" onClick={()=>{const next=!manualOpen;if(next){setLoadingMakes(true);if(make)setLoadingModels(true);}setManualOpen(next);}} className="mt-4 inline-flex items-center gap-2 text-sm font-black underline">{manualOpen?"Hide manual selection":"I don't know my registration / Select vehicle manually"}<ChevronDown size={15} className={manualOpen?"rotate-180 transition":"transition"}/></button>

  {manualOpen&&<div className="mt-4 rounded-2xl border border-black/10 bg-white/60 p-4">
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <SearchableVehicleSelect value={make} options={makes.map(value=>({value,label:nameLabel(value)}))} placeholder={loadingMakes?"Loading makes…":"Search make"} label="Make" disabled={loadingMakes} onChange={resetAfterMake}/>
    <SearchableVehicleSelect value={model} options={models.map(value=>({value,label:nameLabel(value)}))} placeholder={loadingModels?"Loading models…":"Search model"} label="Model" disabled={!make||loadingModels} onChange={resetAfterModel}/>
    <select aria-label="Year" className={control} value={year} disabled={!model||loadingYears} onChange={event=>resetAfterYear(event.target.value)}><option value="">{loadingYears?"Loading years…":"Year"}</option>{years.map(value=><option key={value} value={value}>{value}</option>)}</select>
    <select aria-label="Version" className={control} value={variantId} disabled={!year||loadingVariants} onChange={event=>resetAfterVariant(event.target.value)}><option value="">{loadingVariants?"Loading versions…":"Version / derivative"}</option>{selectedVariant&&!variants.some(item=>item.id===selectedVariant.id)&&<option value={selectedVariant.id}>{selectedVariant.variant}</option>}{variants.map(item=><option key={item.id} value={item.id}>{item.variant}</option>)}</select>
    <select aria-label="Engine and fuel" className={`${control} col-span-2 sm:col-span-2`} value={catalogueEngine} disabled={!variantId||loadingEngines||engines.length===0} onChange={event=>setCatalogueEngine(event.target.value)}><option value="">{loadingEngines?"Loading engine…":engines.length?"Engine / fuel":"Engine data unavailable"}</option>{engines.map(item=><option key={engineKey(item)} value={engineKey(item)}>{item.engineSizeSimple?`${item.engineSizeSimple}cc · ${fuelLabel(item.fuelType)}`:fuelLabel(item.fuelType)}</option>)}</select>
   </div>
   {engines.length>1&&!catalogueEngine&&<p className="mt-3 text-sm text-[#63706a]">Choose the engine and fuel shown for your vehicle. We have left this blank because an exact engine has not been confirmed.</p>}
   {catalogueError&&<p role="status" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{catalogueError}</p>}
   {(loadingYears||loadingVariants||loadingEngines||isApplying)&&<p role="status" className="mt-3 rounded-xl bg-[#eef1eb] px-3 py-2 text-sm font-bold text-[#173c31]">{loadingYears?"Loading available years…":loadingVariants?"Loading exact versions…":loadingEngines?"Loading engine options…":"Applying vehicle and checking compatibility…"}</p>}
   <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!canApply} onClick={applyCatalogue} className="rounded-xl bg-[#d4f44d] px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">{isApplying?"Applying vehicle…":"Use this vehicle"}</button>{(selectedId||activeCatalogue)&&<button type="button" onClick={clearVehicle} className="inline-flex items-center gap-1 text-sm font-bold underline"><X size={14}/>Remove vehicle</button>}</div>
  </div>}

  {selectedLegacy&&<p className="mt-3 rounded-xl bg-[#eef1eb] px-3 py-2 text-xs text-[#63706a]">Selected vehicle: {selectedLegacy.make} {selectedLegacy.model} {selectedLegacy.year}. Compatibility results use the fitment information currently available for this vehicle.</p>}
 </div>;
}
