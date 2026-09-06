"use client";

import Link from "next/link";
import { useActionState,useState } from "react";
import { MessageSquareText,Send } from "lucide-react";
import { askSeller } from "@/app/inbox/start-actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function AskSellerForm({
 partId,
 signedIn,
 ownListing,
 returnTo
}:{
 partId:string;
 signedIn:boolean;
 ownListing:boolean;
 returnTo:string;
}){
 const [open,setOpen]=useState(false);
 const [state,action,pending]=useActionState(askSeller,initial);

 if(ownListing)return null;
 if(!signedIn)return <Link href={"/account?reason=signin-required&returnTo="+encodeURIComponent(returnTo)} className="flex items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-5 py-3 font-black"><MessageSquareText size={18}/>Ask seller</Link>;

 if(!open)return <button type="button" onClick={()=>setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-5 py-3 font-black"><MessageSquareText size={18}/>Ask seller a question</button>;

 return <form action={action} className="rounded-2xl border border-black/10 bg-white p-4">
  <input type="hidden" name="partId" value={partId}/>
  <div className="flex items-center justify-between gap-3"><p className="text-sm font-black">Ask about this exact part</p><button type="button" onClick={()=>setOpen(false)} className="text-xs font-bold underline">Close</button></div>
  <textarea required minLength={2} maxLength={2000} rows={4} name="body" className="mt-3 w-full rounded-xl border border-black/15 bg-[#f8f7f2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Ask about OE/OEM number, connectors, condition, donor vehicle, dimensions or compatibility evidence…"/>
  <p className="mt-2 text-[11px] leading-5 text-[#63706a]">Keep payment inside SecondPart. Never send card details, passwords or security codes in messages.</p>
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  <button disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Send size={15}/>{pending?"Sending…":"Send question"}</button>
 </form>;
}
