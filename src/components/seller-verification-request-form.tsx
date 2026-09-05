"use client";

import { useActionState } from "react";
import { requestSellerVerification } from "@/app/dashboard/verification/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function SellerVerificationRequestForm(){
 const [state,action,pending]=useActionState(requestSellerVerification,initial);
 return <form action={action} className="mt-5">
  <label className="block text-sm font-bold">Anything we should know? <span className="font-normal text-[#63706a]">(optional)</span><textarea name="message" rows={4} maxLength={500} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="For example: registered business name, specialist area or information that helps us review the profile."/></label>
  {state.message&&<p role="status" className={`mt-3 rounded-xl p-3 text-sm font-bold ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
  <button disabled={pending} className="mt-4 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{pending?"Submitting…":"Request verification"}</button>
 </form>;
}
