"use client";

import { useState } from "react";
import { MapPin,X } from "lucide-react";
import { useRouter } from "next/navigation";

export function PostcodeDistanceFilter({initialPostcode}:{initialPostcode?:string}){
 const router=useRouter();
 const [postcode,setPostcode]=useState(initialPostcode??"");
 const apply=()=>{
  const params=new URLSearchParams(window.location.search);
  const value=postcode.trim().toUpperCase();
  if(value)params.set("pc",value);else params.delete("pc");
  router.push(`/?${params.toString()}#marketplace`);
 };
 const clear=()=>{
  setPostcode("");
  const params=new URLSearchParams(window.location.search);
  params.delete("pc");
  router.push(`/?${params.toString()}#marketplace`);
 };
 return <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-4 sm:flex-row sm:items-center">
  <div className="flex items-center gap-2 text-sm font-black"><MapPin size={17} className="text-[#287154]"/>Near you</div>
  <input aria-label="Buyer postcode" value={postcode} onChange={event=>setPostcode(event.target.value.toUpperCase())} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();apply();}}} className="min-w-0 flex-1 rounded-xl border border-black/12 bg-[#f8f7f2] px-3 py-2.5 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="e.g. EH25 9BE"/>
  <button type="button" onClick={apply} className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Show distance</button>
  {initialPostcode&&<button type="button" onClick={clear} aria-label="Clear postcode" className="rounded-xl border border-black/10 p-2.5"><X size={16}/></button>}
 </div>;
}
