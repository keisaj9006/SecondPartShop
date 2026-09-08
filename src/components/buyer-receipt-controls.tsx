"use client";

import { useActionState,useState } from "react";
import { CheckCircle2,PackageCheck } from "lucide-react";
import { confirmBuyerReceipt } from "@/app/account/orders/actions";
import type { ActionState,BuyerOrderItem } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function BuyerReceiptControls({item}:{item:BuyerOrderItem}){
 const [state,action,pending]=useActionState(confirmBuyerReceipt,initial);
 const [confirmAccept,setConfirmAccept]=useState(false);
 const canReceive=["dispatched","ready_for_collection"].includes(item.fulfilmentStatus);
 const canAccept=["dispatched","ready_for_collection","delivered"].includes(item.fulfilmentStatus);

 if(!canReceive&&!canAccept){
  if(item.payoutStatus==="released")return <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700"><CheckCircle2 size={14}/>Transaction completed</p>;
  return null;
 }

 return <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
  <p className="text-xs font-black">Have you received and checked the item?</p>
  <p className="mt-1 text-[11px] leading-5 text-[#63706a]"><strong>I received it</strong> starts the 48-hour buyer-protection review window. Use <strong>Accept item & complete</strong> only after you are satisfied with the part — it makes the seller transfer eligible immediately.</p>
  <div className="mt-2 flex flex-wrap gap-2">
   {canReceive&&item.fulfilmentStatus!=="delivered"&&<form action={action}>
    <input type="hidden" name="orderItemId" value={item.id}/>
    <input type="hidden" name="acceptNow" value="0"/>
    <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-xs font-black disabled:opacity-50"><PackageCheck size={14}/>I received it</button>
   </form>}
   {canAccept&&!confirmAccept&&<button type="button" onClick={()=>setConfirmAccept(true)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><CheckCircle2 size={14}/>Accept item & complete</button>}
  </div>
  {canAccept&&confirmAccept&&<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
   <p className="font-black">Complete this transaction now?</p>
   <p className="mt-1 leading-5">Only continue if you have received and checked the part. This ends the 48-hour review window and makes the seller payout eligible immediately. You can still use formal return/dispute protections where applicable, but do not use this as a simple “received” button.</p>
   <div className="mt-3 flex flex-wrap gap-2">
    <form action={action}>
     <input type="hidden" name="orderItemId" value={item.id}/>
     <input type="hidden" name="acceptNow" value="1"/>
     <button disabled={pending} className="rounded-lg bg-[#173c31] px-3 py-2 font-black text-white disabled:opacity-50">Yes, accept & complete</button>
    </form>
    <button type="button" onClick={()=>setConfirmAccept(false)} disabled={pending} className="rounded-lg border border-black/15 bg-white px-3 py-2 font-black disabled:opacity-50">Keep 48-hour protection</button>
   </div>
  </div>}
  {item.releaseEligibleAt&&item.payoutStatus==="scheduled"&&<p className="mt-2 text-[11px] leading-5 text-[#63706a]">If you do not open a return/dispute case, the seller transfer becomes eligible after {new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.releaseEligibleAt))}.</p>}
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
 </div>;
}
