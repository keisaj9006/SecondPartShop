"use client";

import { useActionState } from "react";
import { AlertTriangle,RotateCcw } from "lucide-react";
import { openTransactionCase } from "@/app/account/cases/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function TransactionCaseForm({orderItemId,partTitle}:{orderItemId:string;partTitle:string}){
 const [state,action,pending]=useActionState(openTransactionCase,initial);
 const input="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";
 return <form action={action} className="mt-5 grid gap-4 rounded-3xl border border-black/10 bg-white p-5">
  <input type="hidden" name="orderItemId" value={orderItemId}/>
  <div><p className="text-xs font-black uppercase tracking-wide text-[#287154]">Transaction item</p><p className="mt-1 font-black">{partTitle}</p></div>
  <label className="text-sm font-bold">What do you need?
   <select name="caseType" defaultValue="return" className={input}>
    <option value="return">Request a return / refund review</option>
    <option value="dispute">Open a transaction dispute</option>
   </select>
  </label>
  <label className="text-sm font-bold">Reason
   <select name="reason" defaultValue="Item not as described" className={input}>
    <option>Item not as described</option>
    <option>Wrong part supplied</option>
    <option>Item arrived damaged</option>
    <option>Item does not work as stated</option>
    <option>Delivery / collection issue</option>
    <option>Other transaction problem</option>
   </select>
  </label>
  <label className="text-sm font-bold">Details
   <textarea required minLength={10} maxLength={2000} rows={5} name="details" className={input} placeholder="Explain what happened and what outcome you are asking for."/>
  </label>
  <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle size={15} className="mr-1 inline"/>Opening a case blocks any seller transfer that has not already been released while the issue is reviewed.</div>
  {state.message&&<p className={"text-sm font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  <button disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-5 py-3 font-black text-white disabled:opacity-50"><RotateCcw size={17}/>{pending?"Opening case…":"Open transaction case"}</button>
 </form>;
}
