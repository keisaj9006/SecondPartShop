"use client";

import { useActionState } from "react";
import { Truck } from "lucide-react";
import { markReturnShipped } from "@/app/account/cases/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function ReturnShipmentForm({caseId}:{caseId:string}){
 const [state,action,pending]=useActionState(markReturnShipped,initial);
 return <form action={action} className="mt-4 rounded-2xl bg-[#f8f7f2] p-4">
  <input type="hidden" name="caseId" value={caseId}/>
  <p className="text-sm font-black">Send the authorised return</p>
  <p className="mt-1 text-xs leading-5 text-[#63706a]">Use a tracked service where possible and keep proof of postage until the case is closed.</p>
  <div className="mt-3 grid gap-2 sm:grid-cols-2">
   <input name="carrier" maxLength={80} placeholder="Carrier e.g. Royal Mail" className="rounded-xl border border-black/15 bg-white px-3 py-2.5 text-sm"/>
   <input required name="tracking" maxLength={120} placeholder="Tracking / shipment reference" className="rounded-xl border border-black/15 bg-white px-3 py-2.5 text-sm"/>
  </div>
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  <button disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Truck size={15}/>{pending?"Saving…":"Mark return as sent"}</button>
 </form>;
}
