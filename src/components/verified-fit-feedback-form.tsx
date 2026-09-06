"use client";

import { useActionState,useState } from "react";
import { CheckCircle2,Clock3,TriangleAlert,Wrench } from "lucide-react";
import { submitVerifiedFitFeedback } from "@/app/account/reviews/fit-actions";
import type { ActionState,FitFeedbackOpportunity,FitFeedbackResult } from "@/lib/types";

const initial:ActionState={status:"idle"};

const options:Array<{value:FitFeedbackResult;label:string;detail:string;icon:typeof CheckCircle2}>=[
 {value:"exact_fit",label:"Yes — exact fit",detail:"The part fitted this vehicle without modification.",icon:CheckCircle2},
 {value:"fit_with_modification",label:"Fit after modification",detail:"It worked, but needed adaptation, coding, trimming or another change.",icon:Wrench},
 {value:"did_not_fit",label:"No — it did not fit",detail:"The part was not compatible with this vehicle configuration.",icon:TriangleAlert},
 {value:"not_installed",label:"I haven't installed it yet",detail:"Save this for now and update it after installation.",icon:Clock3}
];

export function VerifiedFitFeedbackForm({opportunity}:{opportunity:FitFeedbackOpportunity}){
 const [state,action,pending]=useActionState(submitVerifiedFitFeedback,initial);
 const [result,setResult]=useState<FitFeedbackResult|"">(opportunity.existingResult??"");
 const vehicleDetails=[
  opportunity.vehicleVariant,
  opportunity.vehicleEngine?String(opportunity.vehicleEngine)+"cc":null,
  opportunity.vehicleFuel
 ].filter(Boolean).join(" · ");

 return <form action={action} className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 sm:p-5">
  <input type="hidden" name="orderItemId" value={opportunity.orderItemId}/>
  <input type="hidden" name="result" value={result}/>
  <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-900">Verified fitment</p>
  <p className="mt-2 text-sm font-black">{opportunity.vehicleMake} {opportunity.vehicleModel} · {opportunity.vehicleYear}</p>
  <p className="mt-1 text-xs leading-5 text-[#56625d]">{vehicleDetails}</p>
  <p className="mt-3 text-sm font-black">Did this exact part fit this vehicle?</p>

  <div className="mt-3 grid gap-2 sm:grid-cols-2">
   {options.map(option=>{
    const Icon=option.icon;
    const active=result===option.value;
    return <button key={option.value} type="button" onClick={()=>setResult(option.value)} className={"flex min-h-20 items-start gap-3 rounded-xl border p-3 text-left transition "+(active?"border-[#173c31] bg-white ring-2 ring-[#173c31]/10":"border-black/10 bg-white/70")}>
     <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-xl "+(active?"bg-[#173c31] text-[#d4f44d]":"bg-[#eef1eb] text-[#56625d]")}><Icon size={18}/></span>
     <span><strong className="block text-sm">{option.label}</strong><small className="mt-1 block leading-5 text-[#63706a]">{option.detail}</small></span>
    </button>;
   })}
  </div>

  <label className="mt-4 block text-sm font-bold">Fitment notes <span className="font-normal text-[#63706a]">(optional)</span>
   <textarea name="notes" maxLength={1000} rows={3} defaultValue={opportunity.existingNotes??""} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="e.g. Direct fit, same connector and mounting points; coding was required."/>
  </label>

  <p className="mt-3 text-[11px] leading-5 text-[#63706a]">This evidence is tied to your completed SecondPart transaction and the vehicle saved at checkout. Your registration is never shown in public fitment statistics.</p>
  {state.message&&<p role="status" className={"mt-3 rounded-xl p-3 text-sm font-bold "+(state.status==="success"?"bg-emerald-50 text-emerald-800":"bg-red-50 text-red-800")}>{state.message}</p>}
  <button disabled={pending||!result} className="mt-4 w-full rounded-xl bg-[#173c31] px-5 py-3 font-black text-white disabled:opacity-50">{pending?"Saving…":opportunity.existingResult?"Update fitment feedback":"Save verified fitment feedback"}</button>
 </form>;
}
