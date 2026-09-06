"use client";

import { useActionState } from "react";
import { Ban,Undo2 } from "lucide-react";
import { approveFullRefund,rejectTransactionCase } from "@/app/admin/commerce/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

function ResolutionForm({caseId,mode}:{caseId:string;mode:"refund"|"reject"}){
 const handler=mode==="refund"?approveFullRefund:rejectTransactionCase;
 const [state,action,pending]=useActionState(handler,initial);
 return <form action={action} className="rounded-2xl border border-black/10 bg-[#f8f7f2] p-4">
  <input type="hidden" name="caseId" value={caseId}/>
  <label className="text-xs font-black uppercase tracking-wide text-[#63706a]">{mode==="refund"?"Approve full refund":"Close without refund"}
   <textarea name="notes" maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal" placeholder="Internal resolution notes / rationale"/>
  </label>
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  <button disabled={pending} className={"mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black disabled:opacity-50 "+(mode==="refund"?"bg-[#173c31] text-white":"border border-red-200 bg-white text-red-800")}>{mode==="refund"?<Undo2 size={15}/>:<Ban size={15}/>} {pending?"Processing…":mode==="refund"?"Issue full refund":"Reject case"}</button>
 </form>;
}

export function AdminCaseResolution({caseId}:{caseId:string}){
 return <div className="mt-4 grid gap-3 md:grid-cols-2"><ResolutionForm caseId={caseId} mode="refund"/><ResolutionForm caseId={caseId} mode="reject"/></div>;
}
