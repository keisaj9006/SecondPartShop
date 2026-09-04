"use client";

import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront,Search } from "lucide-react";
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
 };
};

const nameLabel=(value:string)=>value.toLowerCase().replace(/(^|[\s/-])\p{L}/gu,match=>match.toUpperCase()).replace(/\bBmw\b/g,"BMW").replace(/\bMg\b/g,"MG").replace(/\bDs\b/g,"DS");
const fuelLabel=(value:string)=>value.toLowerCase().replace(/(^|[\s(-])\p{L}/gu,match=>match.toUpperCase());
const engineKey=(engine:Pick<CatalogueEngine,"fuelType"|"engineSizeSimple">)=>`${engine.fuelType}\u001f${engine.engineSizeSimple??""}`;

async function getItems<T>(url:string,signal?:AbortSignal):Promise<T[]>{
 const response=await fetch(url,{signal});
 const payload=await response.json() as ApiPayload<T>;
 if(!response.ok)throw new Error(payload.message??"Vehicle catalogue is unavailable.");
 return payload.items??[];
}

export function VehicleSelector({
 vehicles,
 catalogueModels,
 selectedId,
 selectedCatalogue,
 baseParams
}:{
 vehicles:Vehicle[];
 catalogueModels:VehicleCatalogueModelOption[];
 selectedId?:string;
 selectedCatalogue:VehicleCatalogueSelection|null;
 baseParams:Record<string,string>;
}){
 const selected=vehicles.find(v=>v.id===selectedId);
 const router=useRouter();

 const makes=useMemo(()=>unique(catalogueModels.map(item=>item.make)).sort((a,b)=>a.localeCompare(b)),[catalogueModels]);
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

 const [registration,setRegistration]=useState("");
 const [lookup,setLookup]=useState<LookupState>({kind:"idle"});
 const [registrationVehicle,setRegistrationVehicle]=useState<RegistrationSummary|null>(null);

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

 const applyCatalogue=()=>{
  if(!variantId||!year)return;
  const params=new URLSearchParams(baseParams);
  params.delete("vehicle");
  params.set("cv",variantId);
  params.set("cy",year);
  const engine=engines.find(item=>engineKey(item)===catalogueEngine);
  if(engine){
   params.set("cf",engine.fuelType);
   if(engine.engineSizeSimple!==null)params.set("ce",String(engine.engineSizeSimple));
  }
  const query=params.toString();
  router.push(`/${query?`?${query}`:""}#marketplace`);
 };

 const chooseLegacy=(id?:string)=>{
  const params=new URLSearchParams(baseParams);
  if(id)params.set("vehicle",id);
  const query=params.toString();
  router.push(`/${query?`?${query}`:""}#marketplace`);
 };

 const clearVehicle=()=>{
  const params=new URLSearchParams(baseParams);
  const query=params.toString();
  router.push(`/${query?`?${query}`:""}#marketplace`);
 };

 const resetAfterMake=(value:string)=>{
  setMake(value);
  setModel("");
  setYear("");
  setVariantId("");
  setCatalogueEngine("");
  setYears([]);
  setVariants([]);
  setEngines([]);
  setLoadingYears(false);
  setLoadingVariants(false);
  setLoadingEngines(false);
  setCatalogueError("");
 };

 const resetAfterModel=(value:string)=>{
  setModel(value);
  setYear("");
  setVariantId("");
  setCatalogueEngine("");
  setYears([]);
  setVariants([]);
  setEngines([]);
  setLoadingYears(Boolean(value));
  setLoadingVariants(false);
  setLoadingEngines(false);
  setCatalogueError("");
 };

 const resetAfterYear=(value:string)=>{
  setYear(value);
  setVariantId("");
  setCatalogueEngine("");
  setVariants([]);
  setEngines([]);
  setLoadingVariants(Boolean(value));
  setLoadingEngines(false);
  setCatalogueError("");
 };

 const resetAfterVariant=(value:string)=>{
  setVariantId(value);
  setCatalogueEngine("");
  setEngines([]);
  setLoadingEngines(Boolean(value));
  setCatalogueError("");
 };

 const findByRegistration=async()=>{
  const value=registration.trim();
  if(!value){setLookup({kind:"error",message:"Enter a UK registration first."});return;}
  setLookup({kind:"loading",message:"Looking up vehicle…"});
  setRegistrationVehicle(null);
  try{
   const response=await fetch("/api/vehicle-lookup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({registration:value}),cache:"no-store"});
   const payload=await response.json() as {message?:string;registration?:string;vehicle?:RegistrationSummary;catalogue?:RegistrationSummary["catalogue"]};
   if(!response.ok){
    setLookup({kind:response.status===503?"info":"error",message:payload.message??"Vehicle lookup is currently unavailable."});
    return;
   }
   if(!payload.vehicle||!payload.registration){
    setLookup({kind:"error",message:"The registration was found, but the vehicle details were incomplete."});
    return;
   }
   const summary:RegistrationSummary={...payload.vehicle,registration:payload.registration,catalogue:payload.catalogue};
   setRegistrationVehicle(summary);
   setLookup({kind:"info",message:payload.catalogue?.modelFamily?"Vehicle found. We have pre-filled the closest catalogue match below.":"Vehicle found. Review the details below."});
   if(payload.catalogue?.make&&payload.catalogue.modelFamily){
    setMake(payload.catalogue.make);
    setModel(payload.catalogue.modelFamily);
    setYear(payload.vehicle.year?String(payload.vehicle.year):"");
    setYears([]);
    setVariants(payload.catalogue.variants??[]);
    setEngines([]);
    setLoadingYears(Boolean(payload.catalogue.modelFamily));
    setLoadingVariants(Boolean(payload.vehicle.year)&&!(payload.catalogue.variants?.length));
    if(payload.catalogue.variants?.length===1){
     setVariantId(payload.catalogue.variants[0].id);
     setLoadingEngines(true);
    }else{
     setVariantId("");
     setLoadingEngines(false);
    }
    setCatalogueEngine("");
   }
  }catch{
   setLookup({kind:"error",message:"Vehicle lookup could not be reached. Use manual selection below."});
  }
 };

 const control="min-w-0 rounded-xl border border-black/12 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31] disabled:bg-black/5";
 const selectedVariant=variants.find(item=>item.id===variantId)??(selectedCatalogue?.variantId===variantId?{id:selectedCatalogue.variantId,variant:selectedCatalogue.variant}:undefined);
 const canApply=Boolean(variantId&&year&&!loadingVariants&&!loadingEngines&&(engines.length===0||catalogueEngine));

 const selectedLegacy=selected;
 const [legacyMake,setLegacyMake]=useState(selectedLegacy?.make??"");
 const [legacyModel,setLegacyModel]=useState(selectedLegacy?.model??"");
 const [legacyGeneration,setLegacyGeneration]=useState(selectedLegacy?.generation??"");
 const [legacyYear,setLegacyYear]=useState(selectedLegacy?String(selectedLegacy.year):"");
 const [legacyEngine,setLegacyEngine]=useState(selectedLegacy?.engine??"");
 const legacyByMake=useMemo(()=>vehicles.filter(v=>v.make===legacyMake),[vehicles,legacyMake]);
 const legacyByModel=legacyByMake.filter(v=>v.model===legacyModel);
 const legacyByGeneration=legacyByModel.filter(v=>v.generation===legacyGeneration);
 const legacyByYear=legacyByGeneration.filter(v=>String(v.year)===legacyYear);
 const finalLegacy=legacyByYear.find(v=>v.engine===legacyEngine);

 return <div>
  <div className="rounded-2xl border border-black/10 bg-white p-4">
   <label className="text-xs font-black uppercase tracking-[.14em] text-[#287154]" htmlFor="registration">Fastest option</label>
   <div className="mt-2 flex flex-col gap-2 sm:flex-row">
    <input id="registration" value={registration} onChange={e=>setRegistration(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void findByRegistration();}}} maxLength={10} autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-black/15 bg-[#f8f7f2] px-4 py-3 font-mono text-base font-bold uppercase tracking-[.12em] outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="AB12 CDE" aria-describedby="registration-help"/>
    <button type="button" onClick={()=>void findByRegistration()} disabled={lookup.kind==="loading"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-60"><Search size={16}/>{lookup.kind==="loading"?"Checking…":"Find my vehicle"}</button>
   </div>
   <p id="registration-help" className="mt-2 text-xs leading-5 text-[#63706a]">Enter a UK registration to identify the vehicle. The registration is sent only to the server-side lookup and is not stored by this form.</p>
   {lookup.message&&<p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${lookup.kind==="error"?"bg-red-50 text-red-800":"bg-[#eef1eb] text-[#173c31]"}`}>{lookup.message}</p>}
   {registrationVehicle&&<div className="mt-3 rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4">
    <div className="flex items-start gap-3">
     <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173c31] text-white"><CarFront size={19}/></span>
     <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-[.12em] text-[#287154]">{registrationVehicle.registration}</p>
      <p className="mt-1 text-lg font-black">{nameLabel(registrationVehicle.make)} {nameLabel(registrationVehicle.model)}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#4f5e57]">
       {registrationVehicle.year&&<span>Year: <strong>{registrationVehicle.year}</strong></span>}
       {registrationVehicle.engineSizeSimple&&<span>Engine: <strong>{registrationVehicle.engineSizeSimple}cc</strong></span>}
       {registrationVehicle.fuelType&&<span>Fuel: <strong>{fuelLabel(registrationVehicle.fuelType)}</strong></span>}
       {registrationVehicle.colour&&<span>Colour: <strong>{nameLabel(registrationVehicle.colour)}</strong></span>}
      </div>
     </div>
    </div>
   </div>}
  </div>

  <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[.12em] text-[#7b847f]"><span className="h-px flex-1 bg-black/10"/><span>or choose manually</span><span className="h-px flex-1 bg-black/10"/></div>

  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
   <select aria-label="Make" className={control} value={make} onChange={e=>resetAfterMake(e.target.value)}><option value="">Make</option>{makes.map(value=><option key={value} value={value}>{nameLabel(value)}</option>)}</select>
   <select aria-label="Model" className={control} value={model} disabled={!make} onChange={e=>resetAfterModel(e.target.value)}><option value="">Model</option>{models.map(value=><option key={value} value={value}>{nameLabel(value)}</option>)}</select>
   <select aria-label="Year" className={control} value={year} disabled={!model||loadingYears} onChange={e=>resetAfterYear(e.target.value)}><option value="">{loadingYears?"Loading years…":"Year"}</option>{years.map(value=><option key={value} value={value}>{value}</option>)}</select>
   <select aria-label="Exact version" className={control} value={variantId} disabled={!year||loadingVariants} onChange={e=>resetAfterVariant(e.target.value)}><option value="">{loadingVariants?"Loading versions…":"Version / derivative"}</option>{selectedVariant&&!variants.some(item=>item.id===selectedVariant.id)&&<option value={selectedVariant.id}>{selectedVariant.variant}</option>}{variants.map(item=><option key={item.id} value={item.id}>{item.variant}</option>)}</select>
   <select aria-label="Engine and fuel" className={`${control} col-span-2 sm:col-span-2`} value={catalogueEngine} disabled={!variantId||loadingEngines||engines.length===0} onChange={e=>setCatalogueEngine(e.target.value)}>
    <option value="">{loadingEngines?"Loading engine…":engines.length?"Engine / fuel":"Engine data unavailable"}</option>
    {engines.map(item=><option key={engineKey(item)} value={engineKey(item)}>{item.engineSizeSimple?`${item.engineSizeSimple}cc · ${fuelLabel(item.fuelType)}`:fuelLabel(item.fuelType)}</option>)}
   </select>
  </div>
  {selectedVariant&&<p className="mt-2 text-xs text-[#63706a]">Selected version: {selectedVariant.variant}</p>}
  {catalogueError&&<p role="status" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{catalogueError}</p>}
  <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!canApply} onClick={applyCatalogue} className="rounded-xl bg-[#d4f44d] px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">Show compatible parts</button>{(selectedId||selectedCatalogue)&&<button type="button" onClick={clearVehicle} className="text-sm font-bold underline">Clear vehicle</button>}</div>
  <p className="mt-3 text-xs leading-5 text-[#7b847f]">Make and model are preloaded for faster selection. Year and version are requested only after you narrow the vehicle, so the browser does not load the whole UK catalogue at once.</p>

  {vehicles.length>0&&<details className="mt-4 rounded-xl border border-black/10 bg-white/60 p-3">
   <summary className="cursor-pointer text-xs font-bold text-[#63706a]">Preview compatibility test vehicles</summary>
   <p className="mt-2 text-xs leading-5 text-[#7b847f]">Temporary QA selector for the existing seeded listings while their fitments are migrated to the full catalogue.</p>
   <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
    <select aria-label="QA make" className={control} value={legacyMake} onChange={e=>{setLegacyMake(e.target.value);setLegacyModel("");setLegacyGeneration("");setLegacyYear("");setLegacyEngine("");}}><option value="">Make</option>{unique(vehicles.map(v=>v.make)).sort((a,b)=>a.localeCompare(b)).map(v=><option key={v}>{v}</option>)}</select>
    <select aria-label="QA model" className={control} value={legacyModel} disabled={!legacyMake} onChange={e=>{setLegacyModel(e.target.value);setLegacyGeneration("");setLegacyYear("");setLegacyEngine("");}}><option value="">Model</option>{unique(legacyByMake.map(v=>v.model)).sort((a,b)=>a.localeCompare(b)).map(v=><option key={v}>{v}</option>)}</select>
    <select aria-label="QA generation" className={control} value={legacyGeneration} disabled={!legacyModel} onChange={e=>{setLegacyGeneration(e.target.value);setLegacyYear("");setLegacyEngine("");}}><option value="">Generation</option>{unique(legacyByModel.map(v=>v.generation)).sort((a,b)=>a.localeCompare(b)).map(v=><option key={v}>{v}</option>)}</select>
    <select aria-label="QA year" className={control} value={legacyYear} disabled={!legacyGeneration} onChange={e=>{setLegacyYear(e.target.value);setLegacyEngine("");}}><option value="">Year</option>{unique(legacyByGeneration.map(v=>String(v.year))).sort((a,b)=>Number(b)-Number(a)).map(v=><option key={v}>{v}</option>)}</select>
    <select aria-label="QA engine" className={`${control} col-span-2 sm:col-span-2`} value={legacyEngine} disabled={!legacyYear} onChange={e=>setLegacyEngine(e.target.value)}><option value="">Engine / variant</option>{unique(legacyByYear.map(v=>v.engine)).sort((a,b)=>a.localeCompare(b)).map(v=><option key={v}>{v}</option>)}</select>
   </div>
   <button type="button" disabled={!finalLegacy} onClick={()=>chooseLegacy(finalLegacy?.id)} className="mt-3 rounded-xl bg-[#173c31] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Use QA vehicle</button>
  </details>}
 </div>;
}
