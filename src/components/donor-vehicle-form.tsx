"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { createDonorVehicle } from "@/app/dashboard/donors/actions";

type LookupVehicle={
 make:string;
 model:string;
 year?:number;
 engineSizeSimple?:number|null;
 fuelType?:string;
 colour?:string;
};

export function DonorVehicleForm(){
 const [registration,setRegistration]=useState("");
 const [make,setMake]=useState("");
 const [model,setModel]=useState("");
 const [year,setYear]=useState("");
 const [engine,setEngine]=useState("");
 const [fuel,setFuel]=useState("");
 const [colour,setColour]=useState("");
 const [lookupMessage,setLookupMessage]=useState("");
 const [loading,setLoading]=useState(false);
 const input="mt-1 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";

 const lookup=async()=>{
  if(!registration.trim()){setLookupMessage("Enter a UK registration first.");return;}
  setLoading(true);setLookupMessage("");
  try{
   const response=await fetch("/api/vehicle-lookup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({registration}),cache:"no-store"});
   const payload=await response.json() as {message?:string;vehicle?:LookupVehicle;registration?:string};
   if(!response.ok||!payload.vehicle){
    setLookupMessage(payload.message??"Vehicle lookup is unavailable. Enter donor details manually.");
    return;
   }
   const vehicle=payload.vehicle;
   setRegistration(payload.registration??registration);
   setMake(vehicle.make??"");
   setModel(vehicle.model??"");
   setYear(vehicle.year?String(vehicle.year):"");
   setEngine(vehicle.engineSizeSimple?String(vehicle.engineSizeSimple):"");
   setFuel(vehicle.fuelType??"");
   setColour(vehicle.colour??"");
   setLookupMessage("Vehicle details found. Review them before saving the donor vehicle.");
  }catch{
   setLookupMessage("Vehicle lookup could not be reached. Enter donor details manually.");
  }finally{
   setLoading(false);
  }
 };

 return <form action={createDonorVehicle} className="mt-8 grid gap-5 rounded-3xl border border-black/10 bg-white p-5 sm:p-7 lg:grid-cols-2">
  <div className="rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 lg:col-span-2">
   <p className="text-sm font-black">Identify donor by registration</p>
   <p className="mt-1 text-xs leading-5 text-[#63706a]">When the official DVSA lookup is connected, this can prefill basic donor details. Until then, use the manual fields below. SecondPart never invents a registration result.</p>
   <div className="mt-3 flex flex-col gap-2 sm:flex-row">
    <input name="registration" value={registration} onChange={event=>setRegistration(event.target.value.toUpperCase())} maxLength={10} className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 font-mono font-bold uppercase tracking-[.12em] outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="AB12 CDE"/>
    <button type="button" onClick={()=>void lookup()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50"><Search size={16}/>{loading?"Checking…":"Look up"}</button>
   </div>
   {lookupMessage&&<p className="mt-3 rounded-xl bg-[#eef1eb] px-3 py-2 text-sm text-[#173c31]">{lookupMessage}</p>}
  </div>

  <label className="text-sm font-bold">Make<input required minLength={2} maxLength={80} name="make" value={make} onChange={event=>setMake(event.target.value)} className={input} placeholder="e.g. Volkswagen"/></label>
  <label className="text-sm font-bold">Model<input required maxLength={120} name="model" value={model} onChange={event=>setModel(event.target.value)} className={input} placeholder="e.g. Golf"/></label>
  <label className="text-sm font-bold">Variant / derivative <span className="font-normal text-[#63706a]">(optional)</span><input maxLength={160} name="variant" className={input} placeholder="e.g. GTD, Mk7"/></label>
  <label className="text-sm font-bold">Year<input required type="number" min="1900" max="2100" name="year" value={year} onChange={event=>setYear(event.target.value)} className={input} placeholder="2018"/></label>
  <label className="text-sm font-bold">Engine size cc <span className="font-normal text-[#63706a]">(optional)</span><input type="number" min="100" max="10000" name="engineSizeSimple" value={engine} onChange={event=>setEngine(event.target.value)} className={input} placeholder="1968"/></label>
  <label className="text-sm font-bold">Fuel type <span className="font-normal text-[#63706a]">(optional)</span><input maxLength={80} name="fuelType" value={fuel} onChange={event=>setFuel(event.target.value)} className={input} placeholder="Diesel"/></label>
  <label className="text-sm font-bold">Colour <span className="font-normal text-[#63706a]">(optional)</span><input maxLength={80} name="colour" value={colour} onChange={event=>setColour(event.target.value)} className={input} placeholder="Black"/></label>
  <label className="text-sm font-bold lg:col-span-2">Seller notes <span className="font-normal text-[#63706a]">(private)</span><textarea maxLength={1000} rows={4} name="notes" className={input} placeholder="Internal donor reference, condition, storage location or dismantling notes."/></label>
  <button className="rounded-xl bg-[#173c31] px-5 py-3.5 font-black text-white lg:col-span-2">Save donor vehicle</button>
 </form>;
}
