"use client";

import { useActionState } from "react";
import { replyToSupportRequest } from "@/app/contact/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function SupportReplyForm({requestId}:{requestId:string}){
 const [state,action,pending]=useActionState(replyToSupportRequest,initial);
 return <form action={action} className="mt-6">
  <input type="hidden" name="requestId" value={requestId}/>
  <label className="block text-sm font-bold">Your reply<textarea name="message" required maxLength={2000} rows={5} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Add any detail that will help support resolve this request. Do not include passwords or payment card details."/></label>
  {state.message&&<p role="status" className={`mt-4 rounded-xl p-3 text-sm font-bold ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
  <button disabled={pending} className="mt-4 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{pending?"Sending…":"Send reply"}</button>
 </form>;
}