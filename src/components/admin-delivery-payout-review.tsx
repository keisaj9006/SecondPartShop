"use client";

import { useActionState } from "react";
import { ShieldCheck,Truck } from "lucide-react";
import { startUnverifiedDeliveryReleaseWindow } from "@/app/admin/commerce/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function AdminDeliveryPayoutReview({
 orderItemId,
 trackingCarrier,
 trackingNumber,
 dispatchedAt,
 ageDays,
 sellerNetPence
}:{
 orderItemId:string;
 trackingCarrier:string|null;
 trackingNumber:string;
 dispatchedAt:string;
 ageDays:number;
 sellerNetPence:number;
}){
 const [state,action,pending]=useActionState(startUnverifiedDeliveryReleaseWindow,initial);
 const money=new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(sellerNetPence/100);

 return <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
  <div className="flex items-start gap-3">
   <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900"><Truck size={18}/></span>
   <div className="min-w-0">
    <p className="text-sm font-black text-amber-950">Unverified delivery payout review</p>
    <p className="mt-1 text-sm leading-6 text-amber-900/80">Dispatched {new Intl.DateTimeFormat("en-GB",{dateStyle:"medium"}).format(new Date(dispatchedAt))} · {ageDays} days ago · seller net {money}.</p>
    <p className="mt-1 break-all text-xs font-bold text-amber-950/75">{trackingCarrier?trackingCarrier+" · ":""}{trackingNumber}</p>
   </div>
  </div>
  <p className="mt-3 text-xs leading-5 text-amber-950/75">Approve only after checking the shipment evidence. Approval does not pay the seller immediately: it starts the normal Buyer Protection window and notifies both parties. A new buyer case still blocks release.</p>
  <form action={action} className="mt-4">
   <input type="hidden" name="orderItemId" value={orderItemId}/>
   <button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><ShieldCheck size={16}/>{pending?"Starting window…":"Approve final release window"}</button>
  </form>
  {state.message&&<p role="status" className={"mt-3 rounded-xl p-3 text-xs font-bold "+(state.status==="error"?"bg-red-100 text-red-900":"bg-emerald-100 text-emerald-900")}>{state.message}</p>}
 </div>;
}
