"use client";

import { useActionState } from "react";
import { Star } from "lucide-react";
import { submitReview } from "@/app/account/reviews/actions";
import type { ActionState,ReviewOpportunity } from "@/lib/types";

const initial:ActionState={status:"idle"};

function Stars({name,label}:{name:string;label:string}){
 return <fieldset>
  <legend className="text-sm font-bold">{label}</legend>
  <div className="mt-2 flex flex-row-reverse justify-end gap-1">
   {[5,4,3,2,1].map(value=><label key={value} className="cursor-pointer">
    <input type="radio" name={name} value={value} className="peer sr-only"/>
    <Star size={25} className="text-black/20 transition peer-checked:fill-current peer-checked:text-amber-500 hover:text-amber-500"/>
   </label>)}
  </div>
 </fieldset>;
}

export function TransactionReviewForm({opportunity}:{opportunity:ReviewOpportunity}){
 const [state,action,pending]=useActionState(submitReview,initial);
 const buyer=opportunity.direction==="buyer_to_seller";
 return <form action={action} className="mt-4 grid gap-5 rounded-2xl bg-[#f8f7f2] p-5">
  <input type="hidden" name="orderItemId" value={opportunity.orderItemId}/>
  <Stars name="overall" label="Overall rating"/>
  {buyer&&<><Stars name="itemAsDescribed" label="Item as described"/><Stars name="dispatch" label="Dispatch"/></>}
  {!buyer&&<Stars name="buyerConduct" label="Buyer conduct"/>}
  <Stars name="communication" label="Communication"/>
  <label className="text-sm font-bold">Written review
   <textarea name="comment" maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Share useful, factual feedback about this transaction."/>
  </label>
  {state.message&&<p className={`text-sm font-bold ${state.status==="success"?"text-emerald-700":"text-red-700"}`}>{state.message}</p>}
  <button disabled={pending} className="rounded-xl bg-[#173c31] px-5 py-3 font-black text-white disabled:opacity-60">{pending?"Submitting…":"Submit verified review"}</button>
 </form>;
}
