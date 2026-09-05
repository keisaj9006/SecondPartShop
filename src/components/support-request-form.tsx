"use client";

import { useActionState } from "react";
import { createSupportRequest } from "@/app/contact/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function SupportRequestForm(){
 const [state,action,pending]=useActionState(createSupportRequest,initial);
 return <form action={action} className="mt-6">
  <label className="block text-sm font-bold">Topic<select name="topic" required defaultValue="" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]"><option value="" disabled>Choose a topic</option><option value="account">Account & sign in</option><option value="seller">Seller account</option><option value="listing">Listing</option><option value="compatibility">Vehicle compatibility</option><option value="safety">Safety / reporting</option><option value="other">Other</option></select></label>
  <label className="mt-4 block text-sm font-bold">Message<textarea name="message" required minLength={10} maxLength={2000} rows={6} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Tell us what happened and what you were trying to do. Do not include passwords, payment card details or API keys."/></label>
  {state.message&&<p role="status" className={`mt-4 rounded-xl p-3 text-sm font-bold ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
  <button disabled={pending} className="mt-5 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{pending?"Submitting…":"Send support request"}</button>
 </form>;
}
