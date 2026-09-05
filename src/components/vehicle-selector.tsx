"use client";

import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront,ChevronDown,Search,X } from "lucide-react";
import type { Vehicle,VehicleCatalogueModelOption,VehicleCatalogueSelection } from "@/lib/types";

const unique=(values:string[])=>[...new Set(values)];
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

async function getItems<T>(url:string,signal?:AbortSignal):Promise<T[]>{
 const controller=new AbortController();
 let timedOut=false;
 const abort=()=>controller.abort();
 signal?.addEventListener("abort",abort,{once:true});
 const timer=window.setTimeout(()=>{timedOut=true;controller.abort();},8000);
 try{
  const response=await fetch(url,{signal:controller.signal});
  const payload=await response.json() as ApiPayload<T>;
  if(!response.ok)throw new Error(payload.message??"Vehicle catalogue is unavailable.");
  return payload.items??[];
 }catch(error){
  if(timedOut)throw new Error("Vehicle options are taking too long to load. Please try again.");
  throw error;
 }finally{
  window.clearTimeout(timer);
  signal?.removeEventListener("abort",abort);
 }
}

function SearchableVehicleSelect({value,options,placeholder,disabled,onChange}:{value:string;options:{value:string;label:string}[];placeholder:string;disabled?:boolean;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false);
 const [term,setTerm]=useState("");
 const [active,setActive]=useState(0);
 const selectedLabel=options.find(option=>option.value===value)?.label??"";
 const normalized=term.trim().toLowerCase();
 const filtered=(normalized?options.filter(option=>option.label.toLowerCase().includes(normalized)):options).slice(0,80);
 const choose=(next:string)=>{onChange(next);setOpen(false);setTerm("");setActive(0);};
 return <div className="relative min-w-0" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){setOpen(false);setTerm("");setActive(0);}}}>
  <input role="combobox" aria-expanded={open} aria-autocomplete="list" disabled={disabled} value={open?term:selectedLabel} onFocus={()=>{setOpen(true);setTerm("");setActive(0);}} onChange={event=>{setTerm(event.target.value);setOpen(true);setActive(0);}} onKeyDown={event=>{
   if(event.key==="ArrowDown"){event.preventDefault();setOpen(true);setActive(index=>Math.min(index+1,Math.max(0,filtered.length-1)));}
   else if(event.key==="ArrowUp"){event.preventDefault();setActive(index=>Math.max(index-1,0));}
   else if(event.key==="Enter"&&open&&filtered[active]){event.preventDefault();choose(filtered[active].value);}
   else if(event.key==="Escape"){setOpen(false);setTerm("");}
  }} className="w-full rounded-xl border border-black/12 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31] disabled:bg-black/5" placeholder={placeholder}/>
  {open&&!disabled&&<div role="listbox" className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-black/10 bg-white p-1 shadow-xl">{filtered.length?filtered.map((option,index)=><button key={option.value} type="button" role="option" aria-selected={option.value===value} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option.value)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${index===active?"bg-[#eef1eb]":"hover:bg-[#eef1eb]"}`}>{option.label}</button>):<p className="px-3 py-3 text-sm text-[#63706a]">No matching options</p>}</div>}
 </div>;
}

export function VehicleSelector({vehicles,catalogueModels,selectedId,selectedCatalogue,baseParams}:{vehicles:Vehicle[];catalogueModels:VehicleCatalogueModelOption[];selectedId?:string;selectedCatalogue:VehicleCatalogueSelection|null;baseParams:Record<string,string>}){
 const selectedLegacy=vehicles.find(vehicle=>vehicle.id===selectedId);
 const router=useRouter();
 const makes=useMemo(()=>unique(catalogueModels.map(item=>item.make)).sort((a,b)=>a.localeCompare(b)),[catalogueModels]);

 const [registration,setRegistration]=useState("");
 const [lookup,setLookup]=useState<LookupState>({kind:"idle"});
 const [registrationVehicle,setRegistrationVehicle]=useState<RegistrationSummary|null>(null);
 const [manualOpen,setManualOpen]=useState(Boolean(selectedCatalogue||selectedLegacy));

 const [make,setMake]=useState(selectedCatalogue?.make??"");
 const models=useMemo(()=>catalogueModels.filter(item=>item.make===make).map(item=>item.modelFamily),[catalogueModels,make]);
 const [model,setModel]=useState(selectedCatalogue?.modelFamily??"");
 const [year,setYear]=useState(selectedCatalogue?String(selectedCatalogue.year):"");
 const [variantId,setVariantId]=useState(selectedCatalogue?.variantId??"");
 const [catalogueEngine,setCatalogueEngine]=useState(selectedCatalogue?.fuelType?engineKey({fuelType:selectedCatalogue.fuelType,engineSizeSimple:selectedCatalogue.engineSizeSimple}):"");
 const [years,setYears]=useState<number[]>([]);
 const [variants,setVariants]=useState<CatalogueVariantOption[]>([]);
 const [engines,setEngines]=useState<CatalogueEngine[]>([]);
 const [loadingYears,setLoadingYears]=useState(Boolean(selectedCatalogue?.modelFamily));
 const [loadingVariants,setLoadingVariants]=useState(Boolean(selectedCatalogue?.year));
 const [loadingEngines,setLoadingEngines]=useState(Boolean(selectedCatalogue?.variantId));
 const [catalogueError,setCatalogueError]=useState("");

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
   .then(items=>{setEngines(items);setLoadingEngines(false);})
   .catch(error=>{if(error instanceof Error&&error.name!=="AbortError"){setCatalogueError(error.message);setLoadingEngines(false);}});
  return()=>controller.abort();
 },[variantId]);

 const pushVehicleParams=(params:URLSearchParams)=>{
  for(const key of ["vehicle","cv","cy","cf","ce","vr"])params.delete(key);
  const qs=params.toString();
  router.push(`/${qs?`?${qs}`:""}#marketplace`);
 };

 const clearVehicle=()=>{
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
  if(registrationVehicle?.registration)params.set("vr",registrationVehicle.registration);else params.delete("vr");
  const qs=params.toString();
  router.push(`/?${qs}#marketplace`);
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
    setLookup({kind:response.status===503?"info":"error",message:payload.message??"Vehicle lookup is currently unavailable."});
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
     setVariantId(only.id);
     const params=new URLSearchParams(baseParams);
     params.set("cv",only.id);
     params.set("cy",String(payload.vehicle.year));
     if(catalogue.engineMatched&&payload.vehicle.fuelType)params.set("cf",payload.vehicle.fuelType);
     if(catalogue.engineMatched&&payload.vehicle.engineSizeSimple)params.set("ce",String(payload.vehicle.engineSizeSimple));
     params.delete("vehicle");
     params.set("vr",payload.registration);
     setLookup({kind:"info",message:"Vehicle found. Compatibility filter applied."});
     const qs=params.toString();
     router.push(`/?${qs}#marketplace`);
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

 const resetAfterMake=(value:string)=>{setMake(value);setModel("");setYear("");setVariantId("");setCatalogueEngine("");setYears([]);setVariants([]);setEngines([]);setLoadingYears(false);setLoadingVariants(false);setLoadingEngines(false);setCatalogueError("");};
 const resetAfterModel=(value:string)=>{setModel(value);setYear("");setVariantId("");setCatalogueEngine("");setYears([]);setVariants([]);setEngines([]);setLoadingYears(Boolean(value));setLoadingVariants(false);setLoadingEngines(false);setCatalogueError("");};
 const resetAfterYear=(value:string)=>{setYear(value);setVariantId("");setCatalogueEngine("");setVariants([]);setEngines([]);setLoadingVariants(Boolean(value));setLoadingEngines(false);setCatalogueError("");};
 const resetAfterVariant=(value:string)=>{setVariantId(value);setCatalogueEngine("");setEngines([]);setLoadingEngines(Boolean(value));setCatalogueError("");};

 const control="min-w-0 rounded-xl border border-black/12 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31] disabled:bg-black/5";
 const selectedVariant=variants.find(item=>item.id===variantId)??(selectedCatalogue?.variantId===variantId?{id:selectedCatalogue.variantId,variant:selectedCatalogue.variant}:undefined);
 const canApply=Boolean(variantId&&year&&!loadingVariants&&!loadingEngines&&(engines.length===0||catalogueEngine));

 return <div>
  <div className="rounded-2xl border border-black/10 bg-white p-4">
   <label className="text-xs font-black uppercase tracking-[.14em] text-[#287154]" htmlFor="registration">Find your vehicle</label>
   <div className="mt-2 flex flex-col gap-2 sm:flex-row">
    <input id="registration" value={registration} onChange={event=>setRegistration(event.target.value.toUpperCase())} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void findByRegistration();}}} maxLength={10} autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-black/15 bg-[#f8f7f2] px-4 py-3 font-mono text-base font-bold uppercase tracking-[.12em] outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="AB12 CDE"/>
    <button type="button" onClick={()=>void findByRegistration()} disabled={lookup.kind==="loading"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-60"><Search size={16}/>{lookup.kind==="loading"?"Checking…":"Find my vehicle"}</button>
   </div>
   <p className="mt-2 text-xs leading-5 text-[#63706a]">Registration lookup uses a real provider only when credentials are configured. We do not fabricate vehicle results.</p>
   {lookup.message&&<p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${lookup.kind==="error"?"bg-red-50 text-red-800":"bg-[#eef1eb] text-[#173c31]"}`}>{lookup.message}</p>}
   {registrationVehicle&&<div className="mt-3 rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173c31] text-white"><CarFront size={19}/></span><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.12em] text-[#287154]">{registrationVehicle.registration}</p><p className="mt-1 text-lg font-black">{nameLabel(registrationVehicle.make)} {nameLabel(registrationVehicle.model)}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#4f5e57]">{registrationVehicle.year&&<span>Year: <strong>{registrationVehicle.year}</strong></span>}{registrationVehicle.engineSizeSimple&&<span>Engine: <strong>{registrationVehicle.engineSizeSimple}cc</strong></span>}{registrationVehicle.fuelType&&<span>Fuel: <strong>{fuelLabel(registrationVehicle.fuelType)}</strong></span>}{registrationVehicle.colour&&<span>Colour: <strong>{nameLabel(registrationVehicle.colour)}</strong></span>}</div></div></div></div>}
  </div>

  <button type="button" onClick={()=>setManualOpen(value=>!value)} className="mt-4 inline-flex items-center gap-2 text-sm font-black underline">{manualOpen?"Hide manual selection":"I don't know my registration / Select vehicle manually"}<ChevronDown size={15} className={manualOpen?"rotate-180 transition":"transition"}/></button>

  {manualOpen&&<div className="mt-4 rounded-2xl border border-black/10 bg-white/60 p-4">
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <SearchableVehicleSelect value={make} options={makes.map(value=>({value,label:nameLabel(value)}))} placeholder="Search make" onChange={resetAfterMake}/>
    <SearchableVehicleSelect value={model} options={models.map(value=>({value,label:nameLabel(value)}))} placeholder="Search model" disabled={!make} onChange={resetAfterModel}/>
    <select aria-label="Year" className={control} value={year} disabled={!model||loadingYears} onChange={event=>resetAfterYear(event.target.value)}><option value="">{loadingYears?"Loading years…":"Year"}</option>{years.map(value=><option key={value} value={value}>{value}</option>)}</select>
    <select aria-label="Version" className={control} value={variantId} disabled={!year||loadingVariants} onChange={event=>resetAfterVariant(event.target.value)}><option value="">{loadingVariants?"Loading versions…":"Version / derivative"}</option>{selectedVariant&&!variants.some(item=>item.id===selectedVariant.id)&&<option value={selectedVariant.id}>{selectedVariant.variant}</option>}{variants.map(item=><option key={item.id} value={item.id}>{item.variant}</option>)}</select>
    <select aria-label="Engine and fuel" className={`${control} col-span-2 sm:col-span-2`} value={catalogueEngine} disabled={!variantId||loadingEngines||engines.length===0} onChange={event=>setCatalogueEngine(event.target.value)}><option value="">{loadingEngines?"Loading engine…":engines.length?"Engine / fuel":"Engine data unavailable"}</option>{engines.map(item=><option key={engineKey(item)} value={engineKey(item)}>{item.engineSizeSimple?`${item.engineSizeSimple}cc · ${fuelLabel(item.fuelType)}`:fuelLabel(item.fuelType)}</option>)}</select>
   </div>
   {catalogueError&&<p role="status" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{catalogueError}</p>}
   <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!canApply} onClick={applyCatalogue} className="rounded-xl bg-[#d4f44d] px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">Use this vehicle</button>{(selectedId||selectedCatalogue)&&<button type="button" onClick={clearVehicle} className="inline-flex items-center gap-1 text-sm font-bold underline"><X size={14}/>Remove vehicle</button>}</div>
  </div>}

  {selectedLegacy&&<p className="mt-3 rounded-xl bg-[#eef1eb] px-3 py-2 text-xs text-[#63706a]">Existing compatibility test vehicle selected: {selectedLegacy.make} {selectedLegacy.model} {selectedLegacy.year}. This preserves legacy QA fitments while the full catalogue fitments are populated.</p>}
 </div>;
}
