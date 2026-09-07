"use client";

import { useActionState } from "react";
import { Ban,PackageCheck,Undo2 } from "lucide-react";
import { approveFullRefund,approveReturnlessRefund,authorizeReturn,rejectTransactionCase } from "@/app/admin/commerce/actions";
import type { ActionState,TransactionCase } from "@/lib/types";

const initial:ActionState={status:"idle"};

function ActionForm({
 caseId,
 action,
 title,
 button,
 danger=false,
 notesRequired=false
}:{
 caseId:string;
 action:(previous:ActionState,formData:FormData)=>Promise<ActionState>;
 title:string;
 button:string;
 danger?:boolean;
 notesRequired?:boolean;
}){
 const [state,formAction,pending]=useActionState(action,initial);
 return <form action={formAction} className="rounded-2xl border border-black/10 bg-[#f8f7f2] p-4">
  <input type="hidden" name="caseId" value={caseId}/>
  <label className="text-xs font-black uppercase tracking-wide text-[#63706a]">{title}
   <textarea required={notesRequired} minLength={notesRequired?10:undefined} name="notes" maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal" placeholder={notesRequired?"Required rationale":"Resolution notes (optional)"}/>
  </label>
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  <button disabled={pending} className={"mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black disabled:opacity-50 "+(danger?"border border-red-200 bg-white text-red-800":"bg-[#173c31] text-white")}>
   {button.includes("refund")?<Undo2 size={15}/>:button.includes("return")?<PackageCheck size={15}/>:<Ban size={15}/>}
   {pending?"Processing…":button}
  </button>
 </form>;
}

export function AdminCaseResolution({item}:{item:TransactionCase}){
 const active=["open","seller_response","under_review","return_authorized","return_shipped","returned"].includes(item.status);
 if(!active)return null;
 if(item.providerDisputeId)return <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-black">Stripe-managed payment dispute</p><p className="mt-1 leading-6">Manual refund and rejection controls are disabled while this provider dispute is open. SecondPart will update the case from Stripe&apos;s final outcome and reverse any released seller transfer if the dispute is lost.</p></div>;

 return <div className="mt-4 grid gap-3 md:grid-cols-2">
  {item.caseType==="return"&&["open","seller_response","under_review"].includes(item.status)&&
   <ActionForm caseId={item.id} action={authorizeReturn} title="Authorise physical return" button="Authorise return"/>}

  {(item.caseType==="dispute"||item.caseType==="cancellation"||item.status==="returned")&&
   <ActionForm caseId={item.id} action={approveFullRefund} title={item.caseType==="cancellation"?"Approve cancellation refund":"Approve full refund"} button={item.caseType==="cancellation"?"Issue cancellation refund":"Issue full refund"}/>}

  {item.caseType==="return"&&item.status!=="returned"&&
   <ActionForm caseId={item.id} action={approveReturnlessRefund} title="Refund without return" button="Issue refund without return" notesRequired/>}

  {["open","seller_response","under_review"].includes(item.status)&&
   <ActionForm caseId={item.id} action={rejectTransactionCase} title="Close without refund" button="Reject case" danger/>}
 </div>;
}
