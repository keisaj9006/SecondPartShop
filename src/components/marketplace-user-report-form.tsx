"use client";

import {useActionState} from "react";
import {Flag} from "lucide-react";
import {submitMarketplaceUserReport} from "@/app/marketplace-safety/actions";
import type {ActionState} from "@/lib/types";

const initial:ActionState={status:"idle"};

export function MarketplaceUserReportForm({targetProfileId}:{targetProfileId:string}){
 const [state,action,pending]=useActionState(submitMarketplaceUserReport,initial);
 return <form action={action} className="mt-6">
  <input type="hidden" name="targetProfileId" value={targetProfileId}/>
  <label className="block text-sm font-bold">Reason
   <select name="reason" required defaultValue="" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]">
    <option value="" disabled>Choose a reason</option>
    <option value="harassment">Harassment or abusive behaviour</option>
    <option value="spam">Spam</option>
    <option value="fraud_scam">Fraud or scam concern</option>
    <option value="seller_conduct">Seller conduct</option>
    <option value="other">Other</option>
   </select>
  </label>
  <label className="mt-4 block text-sm font-bold">Details <span className="font-normal text-[#63706a]">(optional)</span>
   <textarea name="details" maxLength={1000} rows={5} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Tell our moderation team what happened. Do not include passwords or payment-card details."/>
  </label>
  {state.message&&<p role="status" className={"mt-4 rounded-xl p-3 text-sm font-bold "+(state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800")}>{state.message}</p>}
  <button disabled={pending||state.status==="success"} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50"><Flag size={16}/>{pending?"Submitting…":state.status==="success"?"Report submitted":"Submit user report"}</button>
 </form>;
}
