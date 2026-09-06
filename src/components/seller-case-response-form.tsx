"use client";

import { useActionState } from "react";
import { MessageSquareText } from "lucide-react";
import { respondToTransactionCase } from "@/app/dashboard/cases/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function SellerCaseResponseForm({caseId}:{caseId:string}){
 const [state,action,pending]=useActionState(respondToTransactionCase,initial);
 return <form action={action} className="mt-4">
  <input type="hidden" name="caseId" value={caseId}/>
  <label className="text-sm font-bold">Seller response
   <textarea required minLength={10} maxLength={2000} rows={4} name="response" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Explain your side and include useful shipment, condition or listing details."/>
  </label>
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  <button disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><MessageSquareText size={15}/>{pending?"Sending…":"Send response"}</button>
 </form>;
}
