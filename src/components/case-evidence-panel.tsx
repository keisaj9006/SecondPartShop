/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState } from "react";
import { Camera,ExternalLink,LockKeyhole,Upload } from "lucide-react";
import { uploadCaseEvidence } from "@/app/cases/evidence-actions";
import type { ActionState,TransactionCaseEvidence } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function CaseEvidencePanel({
 caseId,
 evidence,
 canUpload
}:{
 caseId:string;
 evidence:TransactionCaseEvidence[];
 canUpload:boolean;
}){
 const [state,action,pending]=useActionState(uploadCaseEvidence,initial);

 return <section className="mt-4 rounded-2xl border border-black/10 bg-[#f8f7f2] p-4">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div>
    <p className="flex items-center gap-2 text-sm font-black"><Camera size={16}/>Case evidence</p>
    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#63706a]"><LockKeyhole size={12}/>Private to the transaction participants and SecondPart administrators.</p>
   </div>
   <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black">{evidence.length}/10</span>
  </div>

  {evidence.length>0&&<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
   {evidence.map(item=><a key={item.id} href={item.signedUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-black/10 bg-white">
    <div className="aspect-square overflow-hidden bg-[#eef1eb]"><img src={item.signedUrl} alt={item.originalName} className="h-full w-full object-cover transition group-hover:scale-[1.02]"/></div>
    <div className="p-2.5">
     <p className="truncate text-xs font-black">{item.originalName}</p>
     <p className="mt-1 text-[10px] text-[#63706a]">@{item.uploaderHandle} · {new Intl.DateTimeFormat("en-GB",{dateStyle:"medium"}).format(new Date(item.createdAt))}</p>
     <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-[#287154]">Open securely <ExternalLink size={10}/></span>
    </div>
   </a>)}
  </div>}

  {!evidence.length&&<p className="mt-3 rounded-xl border border-dashed border-black/15 bg-white p-4 text-xs text-[#63706a]">No evidence images have been attached yet.</p>}

  {canUpload&&evidence.length<10&&<form action={action} className="mt-4 rounded-xl bg-white p-3">
   <input type="hidden" name="caseId" value={caseId}/>
   <label className="text-xs font-black">Add photos
    <input required multiple name="evidence" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-lg border border-black/15 px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef1eb] file:px-3 file:py-2 file:font-bold"/>
   </label>
   <p className="mt-2 text-[11px] leading-5 text-[#63706a]">Up to 5 images per upload, 10 per case, maximum 5 MB each. Useful evidence includes packaging, labels, damage, connectors, part numbers and condition on arrival.</p>
   {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
   <button disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Upload size={14}/>{pending?"Uploading…":"Upload evidence"}</button>
  </form>}
 </section>;
}
