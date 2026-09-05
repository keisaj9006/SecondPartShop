"use client";

import { useActionState } from "react";
import { requestAccountDeletion } from "@/app/account/security/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function AccountDeletionForm(){
 const [state,action,pending]=useActionState(requestAccountDeletion,initial);
 return <form action={action} className="mt-5">
  <label className="block text-sm font-bold text-red-950">Reason <span className="font-normal text-red-900/60">(optional)</span><textarea name="reason" maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-red-700" placeholder="Tell us why you want to leave, if you want to."/></label>
  {state.message&&<p role="status" className={`mt-3 rounded-xl p-3 text-sm font-bold ${state.status==="error"?"bg-red-100 text-red-900":"bg-white text-red-900"}`}>{state.message}</p>}
  <button disabled={pending} className="mt-4 rounded-xl bg-red-800 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{pending?"Submitting…":"Request account deletion"}</button>
 </form>;
}
