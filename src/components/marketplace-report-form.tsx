"use client";

import { useActionState } from "react";
import { submitMarketplaceReport } from "@/app/report/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function MarketplaceReportForm({partId,returnTo}:{partId:string;returnTo:string}){
 const [state,action,pending]=useActionState(submitMarketplaceReport,initial);
 return <form action={action} className="mt-6">
  <input type="hidden" name="partId" value={partId}/><input type="hidden" name="returnTo" value={returnTo}/>
  <label className="block text-sm font-bold">Reason<select name="reason" required defaultValue="" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]"><option value="" disabled>Choose a reason</option><option value="incorrect_fitment">Incorrect compatibility / fitment</option><option value="misleading_description">Misleading description</option><option value="suspected_counterfeit">Suspected counterfeit</option><option value="unsafe_item">Potentially unsafe item</option><option value="seller_conduct">Seller conduct</option><option value="other">Other</option></select></label>
  <label className="mt-4 block text-sm font-bold">Details <span className="font-normal text-[#63706a]">(optional)</span><textarea name="details" maxLength={1000} rows={5} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Explain what looks wrong. Do not include passwords, payment details or other sensitive information."/></label>
  {state.message&&<p role="status" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{state.message}</p>}
  <button disabled={pending} className="mt-5 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{pending?"Submitting…":"Submit report"}</button>
 </form>;
}
