"use client";

import { useActionState } from "react";
import { PackageCheck,Truck } from "lucide-react";
import { updateSaleFulfilment } from "@/app/dashboard/orders/actions";
import type { ActionState,SellerSale } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function SellerFulfilmentControls({sale}:{sale:SellerSale}){
 const [state,action,pending]=useActionState(updateSaleFulfilment,initial);
 if(sale.paymentStatus!=="paid"||["completed","cancelled","refunded","return_requested","return_approved","returned","dispute_open"].includes(sale.fulfilmentStatus))return null;
 if(sale.fulfilmentStatus==="accepted")return <p className={"mt-2 text-xs font-bold "+(sale.payoutStatus==="released"?"text-emerald-700":"text-[#63706a]")}>{sale.payoutStatus==="released"?"Buyer accepted the item · seller transfer released.":"Buyer accepted the item · seller transfer is being finalized automatically."}</p>;

 if(sale.deliveryMethod==="collection"){
  if(sale.fulfilmentStatus==="ready_for_collection")return <p className="mt-2 text-xs font-bold text-[#63706a]">Waiting for buyer receipt / acceptance.</p>;
  return <form action={action} className="mt-3">
   <input type="hidden" name="orderItemId" value={sale.orderItemId}/>
   <input type="hidden" name="fulfilmentAction" value="ready_for_collection"/>
   <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><PackageCheck size={14}/>{pending?"Updating…":"Ready for collection"}</button>
   {state.message&&<p className={"mt-2 text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
  </form>;
 }

 if(sale.fulfilmentStatus==="dispatched"||sale.fulfilmentStatus==="delivered")return <p className="mt-2 text-xs font-bold text-[#63706a]">Waiting for buyer receipt / acceptance.</p>;

 return <form action={action} className="mt-3 grid gap-2">
  <input type="hidden" name="orderItemId" value={sale.orderItemId}/>
  <input type="hidden" name="fulfilmentAction" value="dispatch"/>
  <div className="grid gap-2 sm:grid-cols-2">
   <input name="carrier" maxLength={80} placeholder="Carrier e.g. Royal Mail" className="rounded-lg border border-black/15 px-3 py-2 text-xs"/>
   <input required name="tracking" maxLength={120} placeholder="Tracking / shipment reference" className="rounded-lg border border-black/15 px-3 py-2 text-xs"/>
  </div>
  <button disabled={pending} className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Truck size={14}/>{pending?"Updating…":"Mark dispatched"}</button>
  {state.message&&<p className={"text-xs font-bold "+(state.status==="error"?"text-red-700":"text-emerald-700")}>{state.message}</p>}
 </form>;
}
