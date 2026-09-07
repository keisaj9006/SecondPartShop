"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { AlertTriangle,Check,Copy,ImageIcon,Sparkles } from "lucide-react";

type IdentifierCandidate={
 kind:"oem"|"part_number"|"brand"|"other";
 value:string;
 source:"seller_input"|"visible_image_text";
 confidence:"high"|"medium"|"low";
};

type Draft={
 suggestedTitle:string;
 suggestedDescription:string;
 identifierCandidates:IdentifierCandidate[];
 visibleObservations:string[];
 warnings:string[];
};

type Result={
 draft?:Draft;
 quota?:{remaining:number;resetAt:string|null};
 message?:string;
};

const AI_IMAGE_EDGE=1280;
const AI_IMAGE_MAX_BYTES=1.8*1024*1024;

async function aiPreviewImage(file:File):Promise<File|null>{
 if(file.size<=AI_IMAGE_MAX_BYTES)return file;
 if(typeof createImageBitmap!=="function")return null;

 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,AI_IMAGE_EDGE/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext("2d");
  if(!context)return null;
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);

  for(const quality of [0.72,0.6,0.48]){
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",quality));
   if(blob&&blob.size<=AI_IMAGE_MAX_BYTES){
    return new File([blob],"ai-listing-preview.webp",{type:"image/webp"});
   }
  }
  return null;
 }finally{
  bitmap.close();
 }
}

const label=(kind:IdentifierCandidate["kind"])=>kind==="oem"?"OE/OEM candidate":kind==="part_number"?"Part number candidate":kind==="brand"?"Brand candidate":"Visible text";

export function ListingAiAssistant({
 formRef,
 categoryName,
 donorSummary,
 onApplyTitle,
 onApplyDescription
}:{
 formRef:RefObject<HTMLFormElement|null>;
 categoryName:string;
 donorSummary:string;
 onApplyTitle:(value:string)=>void;
 onApplyDescription:(value:string)=>void;
}){
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [result,setResult]=useState<Result|null>(null);
 const [copied,setCopied]=useState("");

 const generate=async()=>{
  const form=formRef.current;
  if(!form)return;
  setLoading(true);
  setError("");
  try{
   const source=new FormData(form);
   const payload=new FormData();
   for(const field of [
    "title","description","condition","testingStatus","warrantyDays","conditionNotes",
    "damageNotes","oemNumber","manufacturer","partNumber","gearboxFamily","gearboxCode"
   ]){
    const value=source.get(field);
    if(typeof value==="string")payload.set(field,value);
   }
   payload.set("categoryName",categoryName);
   payload.set("donorSummary",donorSummary);

   const photo=source.getAll("images").find(value=>value instanceof File&&value.size>0);
   if(photo instanceof File){
    const preview=await aiPreviewImage(photo);
    if(preview)payload.set("image",preview);
   }

   const response=await fetch("/api/seller/listing-assistant",{
    method:"POST",
    body:payload,
    cache:"no-store"
   });
   const body=await response.json().catch(()=>({})) as Result;
   if(!response.ok)throw new Error(body.message||"AI Listing could not prepare a draft.");
   if(!body.draft)throw new Error("AI Listing returned an empty draft.");
   setResult(body);
  }catch(caught){
   setError(caught instanceof Error?caught.message:"AI Listing could not prepare a draft.");
  }finally{
   setLoading(false);
  }
 };

 const copy=async(value:string,key:string)=>{
  try{
   await navigator.clipboard.writeText(value);
   setCopied(key);
   window.setTimeout(()=>setCopied(current=>current===key?"":current),1500);
  }catch{
   setError("Copy was blocked by the browser. You can select the candidate manually.");
  }
 };

 return <section className="rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4 lg:col-span-2">
  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
   <div>
    <p className="flex items-center gap-2 text-sm font-black"><Sparkles size={17} className="text-[#287154]"/>AI Listing assistant</p>
    <p className="mt-1 max-w-2xl text-xs leading-5 text-[#63706a]">Create a draft from the facts you entered and the first selected product photo. AI cannot confirm fitment, testing or part identifiers. You review everything before saving.</p>
   </div>
   <button type="button" onClick={()=>void generate()} disabled={loading} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Sparkles size={16}/>{loading?"Preparing draft…":"Generate AI draft"}</button>
  </div>

  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><AlertTriangle size={16} className="mt-0.5 shrink-0"/><span>Never use an identifier candidate until you can verify it on the actual part, label, packaging or supplier record. Compatibility must be added separately using evidence you can support.</span></div>
  <p className="mt-2 text-[11px] leading-5 text-[#63706a]">When you press Generate, entered listing fields and at most the first selected photo are sent to the configured AI service to prepare this draft. Nothing is published automatically.</p>

  {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">{error}</p>}

  {result?.draft&&<div className="mt-4 grid gap-3">
   <div className="rounded-xl bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.12em] text-[#287154]">Suggested title</p><p className="mt-2 font-black">{result.draft.suggestedTitle||"No title suggestion"}</p></div>{result.draft.suggestedTitle&&<button type="button" onClick={()=>onApplyTitle(result.draft!.suggestedTitle)} className="rounded-lg border border-[#173c31]/20 px-3 py-2 text-xs font-black">Apply title</button>}</div>
   </div>

   <div className="rounded-xl bg-white p-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.12em] text-[#287154]">Suggested description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#56625d]">{result.draft.suggestedDescription||"No description suggestion"}</p></div>{result.draft.suggestedDescription&&<button type="button" onClick={()=>onApplyDescription(result.draft!.suggestedDescription)} className="shrink-0 rounded-lg border border-[#173c31]/20 px-3 py-2 text-xs font-black">Apply description</button>}</div>
   </div>

   {result.draft.identifierCandidates.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-amber-900"><ImageIcon size={15}/>Text / identifiers to verify</p>
    <div className="mt-3 grid gap-2">{result.draft.identifierCandidates.map((candidate,index)=><div key={candidate.kind+"-"+candidate.value+"-"+index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-xs"><div><p className="font-black">{label(candidate.kind)}: <span className="font-mono">{candidate.value}</span></p><p className="mt-1 text-[#63706a]">{candidate.source==="visible_image_text"?"Read from visible photo text":"Already present in seller input"} · {candidate.confidence} confidence</p></div><button type="button" onClick={()=>void copy(candidate.value,String(index))} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 font-black">{copied===String(index)?<Check size={13}/>:<Copy size={13}/>} {copied===String(index)?"Copied":"Copy"}</button></div>)}</div>
   </div>}

   {result.draft.visibleObservations.length>0&&<div className="rounded-xl bg-white p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[#287154]">Visible observations</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[#56625d]">{result.draft.visibleObservations.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
   {result.draft.warnings.length>0&&<div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-amber-900">Check before saving</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-950">{result.draft.warnings.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
   {result.quota&&<p className="text-[11px] text-[#63706a]">{result.quota.remaining} AI draft{result.quota.remaining===1?"":"s"} remaining in the current hourly quota.</p>}
  </div>}
 </section>;
}
