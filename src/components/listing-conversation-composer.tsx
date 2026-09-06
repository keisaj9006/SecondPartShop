"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { sendListingMessage } from "@/app/inbox/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function ListingConversationComposer({conversationId}:{conversationId:string}){
 const [state,action,pending]=useActionState(sendListingMessage,initial);
 return <form action={action} className="border-t border-black/10 bg-white p-4">
  <input type="hidden" name="conversationId" value={conversationId}/>
  <div className="flex items-end gap-2">
   <textarea required maxLength={2000} rows={2} name="body" className="min-h-12 flex-1 resize-y rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Write a reply…"/>
   <button disabled={pending} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#173c31] text-white disabled:opacity-50" aria-label="Send message"><Send size={18}/></button>
  </div>
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  <p className="mt-2 text-[11px] leading-5 text-[#63706a]">Do not move payment off-platform or share payment-card/security details.</p>
 </form>;
}
