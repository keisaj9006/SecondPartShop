"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CreditCard,LockKeyhole,MapPin,Truck } from "lucide-react";
import { startCheckout } from "@/app/checkout/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function BuyNowForm({
 partId,
 stock,
 shippingPence,
 collectionAvailable,
 signedIn,
 ownListing,
 checkoutReady,
 returnTo
}:{
 partId:string;
 stock:number;
 shippingPence:number;
 collectionAvailable:boolean;
 signedIn:boolean;
 ownListing:boolean;
 checkoutReady:boolean;
 returnTo:string;
}){
 const [state,action,pending]=useActionState(startCheckout,initial);
 const maxQuantity=Math.max(1,Math.min(stock,10));

 if(ownListing)return <div className="mt-5 rounded-2xl bg-[#eef1eb] p-4 text-sm font-bold text-[#56625d]">This is your own listing, so purchase controls are hidden.</div>;

 if(!signedIn)return <Link href={"/account?reason=signin-required&returnTo="+encodeURIComponent(returnTo)} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-5 py-3.5 font-black text-white"><CreditCard size={18}/>Sign in to buy</Link>;

 return <form action={action} className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
  <input type="hidden" name="partId" value={partId}/>
  <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
   <label className="text-sm font-bold">Quantity
    <select name="quantity" defaultValue="1" disabled={!checkoutReady||pending} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-3 py-3">
     {Array.from({length:maxQuantity},(_,index)=>index+1).map(value=><option key={value} value={value}>{value}</option>)}
    </select>
   </label>
   <fieldset>
    <legend className="text-sm font-bold">Delivery method</legend>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
     <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 p-3 text-sm font-bold"><input type="radio" name="deliveryMethod" value="shipping" defaultChecked/><Truck size={17}/>Delivery {shippingPence>0?"£"+(shippingPence/100).toFixed(2):"Free"}</label>
     {collectionAvailable&&<label className="flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 p-3 text-sm font-bold"><input type="radio" name="deliveryMethod" value="collection"/><MapPin size={17}/>Collection · Free</label>}
    </div>
   </fieldset>
  </div>

  {!checkoutReady&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Checkout is not available for this seller yet.</p>}
  {state.message&&<p role="status" className={"mt-3 rounded-xl p-3 text-sm font-bold "+(state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800")}>{state.message}</p>}

  <button disabled={!checkoutReady||pending||stock<1} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4f44d] px-5 py-3.5 font-black text-[#173c31] disabled:cursor-not-allowed disabled:opacity-50"><CreditCard size={18}/>{pending?"Opening secure checkout…":"Buy now"}</button>
  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#63706a]"><LockKeyhole size={13}/>Secure marketplace checkout. Seller transfer is released through the SecondPart transaction flow.</p>
 </form>;
}
