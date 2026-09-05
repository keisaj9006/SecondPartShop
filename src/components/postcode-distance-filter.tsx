"use client";

import { useState } from "react";
import { MapPin,X } from "lucide-react";
import { useRouter } from "next/navigation";

export function PostcodeDistanceFilter({initialPostcode}:{initialPostcode?:string}){
 const router=useRouter();
 const [postcode,setPostcode]=useState(initialPostcode??"");
 const [message,setMessage]=useState("");
 const [checking,setChecking]=useState(false);
 const apply=async()=>{
  const value=postcode.trim().toUpperCase();
  if(!value){clear();return;}
  setChecking(true);setMessage("");
  try{
   const response=await fetch("/api/postcode-lookup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({postcode:value}),cache:"no-store"});
   const payload=await response.json() as {ok?:boolean;postcode?:string;message?:string};
   if(!response.ok||!payload.ok){
    setMessage(payload.message??"We could not confirm that postcode.");
    return;
   }
   const confirmed=payload.postcode??value;
   setPostcode(confirmed);
   const params=new URLSearchParams(window.location.search);
   params.set("pc",confirmed);
   router.push(`/?${params.toString()}#marketplace`);
  }catch{
   setMessage("Postcode lookup is temporarily unavailable.");
  }finally{
   setChecking(false);
  }
 };
 const clear=()=>{
  setPostcode("");setMessage("");
  const params=new URLSearchParams(window.location.search);
  params.delete("pc");
  router.push(`/?${params.toString()}#marketplace`);
 };
 return <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-4 sm:flex-row sm:items-center">
  <div className="flex items-center gap-2 text-sm font-black"><MapPin size={17} className="text-[#287154]"/>Near you</div>
  <input aria-label="Buyer postcode" value={postcode} onChange={event=>setPostcode(event.target.value.toUpperCase())} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void apply();}}} className="min-w-0 flex-1 rounded-xl border border-black/12 bg-[#f8f7f2] px-3 py-2.5 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="e.g. EH25 9BE"/>
  <button type="button" onClick={()=>void apply()} disabled={checking} className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{checking?"Checking…":"Show distance"}</button>
  {initialPostcode&&<button type="button" onClick={clear} aria-label="Clear postcode" className="rounded-xl border border-black/10 p-2.5"><X size={16}/></button>}
  {message&&<p role="status" className="text-xs font-bold text-amber-800 sm:basis-full">{message}</p>}
 </div>;
}
