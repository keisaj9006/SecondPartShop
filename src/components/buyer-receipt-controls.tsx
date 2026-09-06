"use client";

import { useActionState } from "react";
import { CheckCircle2,PackageCheck } from "lucide-react";
import { confirmBuyerReceipt } from "@/app/account/orders/actions";
import type { ActionState,BuyerOrderItem } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function BuyerReceiptControls({item}:{item:BuyerOrderItem}){
 const [state,action,pending]=useActionState(confirmBuyerReceipt,initial);
 const canReceive=["dispatched","ready_for_collection"].includes(item.fulfilmentStatus);
 const canAccept=["dispatched","ready_for_collection","delivered"].includes(item.fulfilmentStatus);

 if(!canReceive&&!canAccept){
  if(item.payoutStatus==="released")return <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700"><CheckCircle2 size={14}/>Transaction completed</p>;
  return null;
 }

 return <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
  <p className="text-xs font-black">Have you received and checked the item?</p>
  <div className="mt-2 flex flex-wrap gap-2">
   {canReceive&&item.fulfilmentStatus!=="delivered"&&<form action={action}>
    <input type="hidden" name="orderItemId" value={item.id}/>
    <input type="hidden" name="acceptNow" value="0"/>
    <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-xs font-black disabled:opacity-50"><PackageCheck size={14}/>I received it</button>
   </form>}
   {canAccept&&<form action={action}>
    <input type="hidden" name="orderItemId" value={item.id}/>
    <input type="hidden" name="acceptNow" value="1"/>
    <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><CheckCircle2 size={14}/>Accept item & complete</button>
   </form>}
  </div>
  {item.releaseEligibleAt&&item.payoutStatus==="scheduled"&&<p className="mt-2 text-[11px] leading-5 text-[#63706a]">If you do not open a return/dispute case, the seller transfer becomes eligible after {new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.releaseEligibleAt))}.</p>}
  {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
 </div>;
}
