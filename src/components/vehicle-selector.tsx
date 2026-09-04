"use client";
import { useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Vehicle } from "@/lib/types";

const unique=(values:string[])=>[...new Set(values)];
type LookupState={kind:"idle"|"loading"|"error"|"info";message?:string};

export function VehicleSelector({vehicles,selectedId,baseParams}:{vehicles:Vehicle[];selectedId?:string;baseParams:Record<string,string>}){
 const selected=vehicles.find(v=>v.id===selectedId);
 const [registration,setRegistration]=useState("");
 const [lookup,setLookup]=useState<LookupState>({kind:"idle"});
 const [make,setMake]=useState(selected?.make??"");
 const [model,setModel]=useState(selected?.model??"");
 const [generation,setGeneration]=useState(selected?.generation??"");
 const [year,setYear]=useState(selected?String(selected.year):"");
 const [engine,setEngine]=useState(selected?.engine??"");
 const router=useRouter();
 const byMake=useMemo(()=>vehicles.filter(v=>v.make===make),[vehicles,make]);
 const byModel=byMake.filter(v=>v.model===model);
 const byGeneration=byModel.filter(v=>v.generation===generation);
 const byYear=byGeneration.filter(v=>String(v.year)===year);
 const finalVehicle=byYear.find(v=>v.engine===engine);
 const choose=(id?:string)=>{const params=new URLSearchParams(baseParams);if(id)params.set("vehicle",id);else params.delete("vehicle");const query=params.toString();router.push(`/${query?`?${query}`:""}#marketplace`);};
 const findByRegistration=async()=>{
  const value=registration.trim();
  if(!value){setLookup({kind:"error",message:"Enter a UK registration first."});return;}
  setLookup({kind:"loading",message:"Looking up vehicle…"});
  try{
   const response=await fetch("/api/vehicle-lookup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({registration:value})});
   const payload=await response.json() as {message?:string;vehicleId?:string};
   if(response.ok&&payload.vehicleId){setLookup({kind:"info",message:"Vehicle found. Applying compatibility filter…"});choose(payload.vehicleId);return;}
   setLookup({kind:response.status===503?"info":"error",message:payload.message??"Vehicle lookup is currently unavailable."});
  }catch{setLookup({kind:"error",message:"Vehicle lookup could not be reached. Use manual selection below."});}
 };
 const control="min-w-0 rounded-xl border border-black/12 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31] disabled:bg-black/5";
 const makes=unique(vehicles.map(v=>v.make)).sort((a,b)=>a.localeCompare(b));
 const years=unique(byGeneration.map(v=>String(v.year))).sort((a,b)=>Number(b)-Number(a));
 const engines=unique(byYear.map(v=>v.engine)).sort((a,b)=>a.localeCompare(b));
 return <div>
  <div className="rounded-2xl border border-black/10 bg-white p-4">
   <label className="text-xs font-black uppercase tracking-[.14em] text-[#287154]" htmlFor="registration">Fastest option</label>
   <div className="mt-2 flex flex-col gap-2 sm:flex-row">
    <input id="registration" value={registration} onChange={e=>setRegistration(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void findByRegistration();}}} maxLength={10} autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-black/15 bg-[#f8f7f2] px-4 py-3 font-mono text-base font-bold uppercase tracking-[.12em] outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="AB12 CDE" aria-describedby="registration-help"/>
    <button type="button" onClick={()=>void findByRegistration()} disabled={lookup.kind==="loading"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-60"><Search size={16}/>{lookup.kind==="loading"?"Checking…":"Find my vehicle"}</button>
   </div>
   <p id="registration-help" className="mt-2 text-xs leading-5 text-[#63706a]">UK registration lookup is prepared for a verified data provider. No registration is stored or matched to made-up vehicle data.</p>
   {lookup.message&&<p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${lookup.kind==="error"?"bg-red-50 text-red-800":"bg-[#eef1eb] text-[#173c31]"}`}>{lookup.message}</p>}
  </div>
  <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[.12em] text-[#7b847f]"><span className="h-px flex-1 bg-black/10"/><span>or choose manually</span><span className="h-px flex-1 bg-black/10"/></div>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
   <select aria-label="Make" className={control} value={make} onChange={e=>{setMake(e.target.value);setModel("");setGeneration("");setYear("");setEngine("");}}><option value="">Make</option>{makes.map(v=><option key={v}>{v}</option>)}</select>
   <select aria-label="Model" className={control} value={model} disabled={!make} onChange={e=>{setModel(e.target.value);setGeneration("");setYear("");setEngine("");}}><option value="">Model</option>{unique(byMake.map(v=>v.model)).sort((a,b)=>a.localeCompare(b)).map(v=><option key={v}>{v}</option>)}</select>
   <select aria-label="Generation" className={control} value={generation} disabled={!model} onChange={e=>{setGeneration(e.target.value);setYear("");setEngine("");}}><option value="">Generation</option>{unique(byModel.map(v=>v.generation)).sort((a,b)=>a.localeCompare(b)).map(v=><option key={v}>{v}</option>)}</select>
   <select aria-label="Year" className={control} value={year} disabled={!generation} onChange={e=>{setYear(e.target.value);setEngine("");}}><option value="">Year</option>{years.map(v=><option key={v}>{v}</option>)}</select>
   <select aria-label="Engine" className={`${control} col-span-2 sm:col-span-2`} value={engine} disabled={!year} onChange={e=>setEngine(e.target.value)}><option value="">Engine / variant</option>{engines.map(v=>{const sample=byYear.find(item=>item.engine===v);return <option key={v} value={v}>{v}{sample?.fuelType?` · ${sample.fuelType}`:""}</option>})}</select>
  </div>
  <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={!finalVehicle} onClick={()=>choose(finalVehicle?.id)} className="rounded-xl bg-[#d4f44d] px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">Show compatible parts</button>{selectedId&&<button type="button" onClick={()=>choose()} className="text-sm font-bold underline">Clear vehicle</button>}</div>
  <p className="mt-3 text-xs leading-5 text-[#7b847f]">The expanded vehicle catalogue is currently QA data for interface testing. Verified UK vehicle-provider data will replace or supplement it before launch.</p>
 </div>;
}
