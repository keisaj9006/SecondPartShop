"use client";
import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Vehicle,VehicleCatalogueSelection } from "@/lib/types";

const unique=(values:string[])=>[...new Set(values)];
type LookupState={kind:"idle"|"loading"|"error"|"info";message?:string};
type CatalogueVariant={id:string;make:string;modelFamily:string;variant:string;bodyType:string|null};
type CatalogueEngine={fuelType:string;engineSizeSimple:number|null;engineSizeDesc:string|null};
type ApiPayload<T>={items?:T[];message?:string};

const nameLabel=(value:string)=>value.toLowerCase().replace(/(^|[\s/-])\p{L}/gu,match=>match.toUpperCase()).replace(/\bBmw\b/g,"BMW").replace(/\bMg\b/g,"MG").replace(/\bDs\b/g,"DS");
const fuelLabel=(value:string)=>value.toLowerCase().replace(/(^|[\s(-])\p{L}/gu,match=>match.toUpperCase());
const engineKey=(engine:Pick<CatalogueEngine,"fuelType"|"engineSizeSimple">)=>`${engine.fuelType}\u001f${engine.engineSizeSimple??""}`;

async function getItems<T>(url:string,signal?:AbortSignal):Promise<T[]>{
 const response=await fetch(url,{signal});
 const payload=await response.json() as ApiPayload<T>;
 if(!response.ok)throw new Error(payload.message??"Vehicle catalogue is unavailable.");
 return payload.items??[];
}

export function VehicleSelector({vehicles,selectedId,selectedCatalogue,baseParams}:{vehicles:Vehicle[];selectedId?:string;selectedCatalogue:VehicleCatalogueSelection|null;baseParams:Record<string,string>}){
 const selected=vehicles.find(v=>v.id===selectedId);
 const [registration,setRegistration]=useState("");
 const [lookup,setLookup]=useState<LookupState>({kind:"idle"});
 const router=useRouter();

 const [makes,setMakes]=useState<string[]>([]);
 const [models,setModels]=useState<string[]>([]);
 const [variants,setVariants]=useState<CatalogueVariant[]>([]);
 const [years,setYears]=useState<number[]>([]);
 const [engines,setEngines]=useState<CatalogueEngine[]>([]);
 const [catalogueError,setCatalogueError]=useState("");
 const [detailsLoading,setDetailsLoading]=useState(Boolean(selectedCatalogue?.variantId));
 const [make,setMake]=useState(selectedCatalogue?.make??"");
 const [model,setModel]=useState(selectedCatalogue?.modelFamily??"");
 const [variantId,setVariantId]=useState(selectedCatalogue?.variantId??"");
 const [year,setYear]=useState(selectedCatalogue?String(selectedCatalogue.year):"");
 const [catalogueEngine,setCatalogueEngine]=useState(selectedCatalogue?.fuelType?engineKey({fuelType:selectedCatalogue.fuelType,engineSizeSimple:selectedCatalogue.engineSizeSimple}):"");

 useEffect(()=>{
  const controller=new AbortController();
  void getItems<string>("/api/vehicle-catalogue?level=makes",controller.signal).then(setMakes).catch(error=>{if(error instanceof Error&&error.name!=="AbortError")setCatalogueError(error.message);});
  return()=>controller.abort();
 },[]);

 useEffect(()=>{
  if(!make)return;
  const controller=new AbortController();
  void getItems<string>(`/api/vehicle-catalogue?level=models&make=${encodeURIComponent(make)}`,controller.signal).then(setModels).catch(error=>{if(error instanceof Error&&error.name!=="AbortError")setCatalogueError(error.message);});
  return()=>controller.abort();
 },[make]);

 useEffect(()=>{
  if(!make||!model)return;
  const controller=new AbortController();
  void getItems<CatalogueVariant>(`/api/vehicle-catalogue?level=variants&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,controller.signal).then(setVariants).catch(error=>{if(error instanceof Error&&error.name!=="AbortError")setCatalogueError(error.message);});
  return()=>controller.abort();
 },[make,model]);

 useEffect(()=>{
  if(!variantId)return;
  const controller=new AbortController();
  void Promise.all([
   getItems<number>(`/api/vehicle-catalogue?level=years&variantId=${encodeURIComponent(variantId)}`,controller.signal),
   getItems<CatalogueEngine>(`/api/vehicle-catalogue?level=engines&variantId=${encodeURIComponent(variantId)}`,controller.signal)
  ]).then(([yearItems,engineItems])=>{setYears(yearItems);setEngines(engineItems);setDetailsLoading(false);}).catch(error=>{if(error instanceof Error&&error.name!=="AbortError"){setCatalogueError(error.message);setDetailsLoading(false);}});
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

 const findByRegistration=async()=>{
  const value=registration.trim();
  if(!value){setLookup({kind:"error",message:"Enter a UK registration first."});return;}
  setLookup({kind:"loading",message:"Looking up vehicle…"});
  try{
   const response=await fetch("/api/vehicle-lookup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({registration:value})});
   const payload=await response.json() as {message?:string;vehicleId?:string;catalogueVariantId?:string;year?:number;fuelType?:string;engineSizeSimple?:number};
   if(response.ok&&payload.catalogueVariantId&&payload.year){
    const params=new URLSearchParams(baseParams);
    params.set("cv",payload.catalogueVariantId);
    params.set("cy",String(payload.year));
    if(payload.fuelType)params.set("cf",payload.fuelType);
    if(payload.engineSizeSimple!==undefined)params.set("ce",String(payload.engineSizeSimple));
    setLookup({kind:"info",message:"Vehicle found. Applying compatibility filter…"});
    router.push(`/?${params.toString()}#marketplace`);
    return;
   }
   if(response.ok&&payload.vehicleId){setLookup({kind:"info",message:"Vehicle found. Applying compatibility filter…"});chooseLegacy(payload.vehicleId);return;}
   setLookup({kind:response.status===503?"info":"error",message:payload.message??"Vehicle lookup is currently unavailable."});
  }catch{setLookup({kind:"error",message:"Vehicle lookup could not be reached. Use manual selection below."});}
 };

 const control="min-w-0 rounded-xl border border-black/12 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31] disabled:bg-black/5";
 const selectedVariant=variants.find(item=>item.id===variantId);
 const canApply=Boolean(variantId&&year&&!detailsLoading&&(engines.length===0||catalogueEngine));
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
   <p id="registration-help" className="mt-2 text-xs leading-5 text-[#63706a]">Registration lookup will use a verified UK data source. Registration numbers are not matched to fabricated vehicle data.</p>
   {lookup.message&&<p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${lookup.kind==="error"?"bg-red-50 text-red-800":"bg-[#eef1eb] text-[#173c31]"}`}>{lookup.message}</p>}
  </div>

  <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[.12em] text-[#7b847f]"><span className="h-px flex-1 bg-black/10"/><span>or choose manually</span><span className="h-px flex-1 bg-black/10"/></div>

  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
   <select aria-label="Make" className={control} value={make} onChange={e=>{setMake(e.target.value);setModel("");setModels([]);setVariantId("");setVariants([]);setYears([]);setEngines([]);setYear("");setCatalogueEngine("");setDetailsLoading(false);setCatalogueError("");}}><option value="">Make</option>{makes.map(value=><option key={value} value={value}>{nameLabel(value)}</option>)}</select>
   <select aria-label="Model" className={control} value={model} disabled={!make} onChange={e=>{setModel(e.target.value);setVariantId("");setVariants([]);setYears([]);setEngines([]);setYear("");setCatalogueEngine("");setDetailsLoading(false);setCatalogueError("");}}><option value="">Model</option>{models.map(value=><option key={value} value={value}>{nameLabel(value)}</option>)}</select>
   <select aria-label="Exact variant" className={control} value={variantId} disabled={!model} onChange={e=>{const value=e.target.value;setVariantId(value);setYears([]);setEngines([]);setYear("");setCatalogueEngine("");setDetailsLoading(Boolean(value));setCatalogueError("");}}><option value="">Exact variant</option>{variants.map(item=><option key={item.id} value={item.id}>{item.variant}</option>)}</select>
   <select aria-label="Year" className={control} value={year} disabled={!variantId||detailsLoading} onChange={e=>setYear(e.target.value)}><option value="">{detailsLoading?"Loading…":"Year"}</option>{years.map(value=><option key={value} value={value}>{value}</option>)}</select>
   <select aria-label="Engine and fuel" className={`${control} col-span-2 sm:col-span-2`} value={catalogueEngine} disabled={!variantId||detailsLoading||engines.length===0} onChange={e=>setCatalogueEngine(e.target.value)}>
    <option value="">{detailsLoading?"Loading…":engines.length?"Engine / fuel":"Engine data unavailable"}</option>
    {engines.map(item=><option key={engineKey(item)} value={engineKey(item)}>{item.engineSizeSimple?`${item.engineSizeSimple}cc · ${fuelLabel(item.fuelType)}`:fuelLabel(item.fuelType)}</option>)}
   </select>
  </div>
  {selectedVariant&&<p className="mt-2 text-xs text-[#63706a]">DfT catalogue variant: {selectedVariant.variant}</p>}
  {catalogueError&&<p role="status" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{catalogueError}</p>}
  <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!canApply} onClick={applyCatalogue} className="rounded-xl bg-[#d4f44d] px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">Show compatible parts</button>{(selectedId||selectedCatalogue)&&<button type="button" onClick={clearVehicle} className="text-sm font-bold underline">Clear vehicle</button>}</div>
  <p className="mt-3 text-xs leading-5 text-[#7b847f]">Manual vehicle identification now uses the imported UK Department for Transport catalogue. Vehicle availability does not by itself guarantee that a seller has provided fitment data for a part.</p>

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
