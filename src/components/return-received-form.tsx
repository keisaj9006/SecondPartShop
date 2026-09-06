"use client";

import { useActionState } from "react";
import { PackageCheck } from "lucide-react";
import { confirmReturnReceived } from "@/app/dashboard/cases/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function ReturnReceivedForm({caseId}:{caseId:string}){
 const [state,action,pending]=useActionState(confirmReturnReceived,initial);
 return <form action={action} className="mt-4 rounded-2xl bg-[#f8f7f2] p-4">
  <input type="hidden" name="caseId" value={caseId}/>
  <p className="text-sm font-black">Returned item received?</p>
  <p className="mt-1 text-xs leading-5 text-[#63706a]">Confirm only after the returned part is physically back with you. This moves the case to refund review.</p>
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  <button disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><PackageCheck size={15}/>{pending?"Confirming…":"Confirm return received"}</button>
 </form>;
}
