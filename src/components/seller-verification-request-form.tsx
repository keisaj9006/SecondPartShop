"use client";

import { useActionState } from "react";
import { requestSellerVerification } from "@/app/dashboard/verification/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function SellerVerificationRequestForm({defaultLegalName}:{defaultLegalName:string}){
 const [state,action,pending]=useActionState(requestSellerVerification,initial);
 return <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
  <label className="block text-sm font-bold sm:col-span-2">Legal / registered business name<input required minLength={2} maxLength={180} name="legalBusinessName" defaultValue={defaultLegalName} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]"/></label>
  <label className="block text-sm font-bold">Business / licensing reference <span className="font-normal text-[#63706a]">(if available)</span><input maxLength={180} name="businessReference" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Company, ATF, licence or trade reference"/></label>
  <label className="block text-sm font-bold">Public business URL <span className="font-normal text-[#63706a]">(if available)</span><input type="url" maxLength={500} name="referenceUrl" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="https://business-site.example"/></label>
  <p className="text-xs leading-5 text-[#63706a] sm:col-span-2">Provide at least one business/licensing reference or a public HTTPS website / marketplace profile. Do not upload identity documents here; Stripe handles payout identity separately.</p>
  <label className="block text-sm font-bold sm:col-span-2">Anything else we should know? <span className="font-normal text-[#63706a]">(optional)</span><textarea name="message" rows={4} maxLength={500} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="For example: registered business name, specialist area or information that helps us review the profile."/></label>
  {state.message&&<p role="status" className={`rounded-xl p-3 text-sm font-bold sm:col-span-2 ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
  <button disabled={pending} className="rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">{pending?"Submitting…":"Request verification"}</button>
 </form>;
}
