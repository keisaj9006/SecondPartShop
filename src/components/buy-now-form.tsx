"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle,CheckCircle2,CreditCard,LockKeyhole,MapPin,Truck,UsersRound } from "lucide-react";
import { startCheckout } from "@/app/checkout/actions";
import type { ActionState,CompatibilityInfo } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function BuyNowForm({
 partId,
 stock,
 shippingPence,
 collectionAvailable,
 signedIn,
 ownListing,
 checkoutReady,
 returnTo,
 vehicleContext,
 compatibility
}:{
 partId:string;
 stock:number;
 shippingPence:number;
 collectionAvailable:boolean;
 signedIn:boolean;
 ownListing:boolean;
 checkoutReady:boolean;
 returnTo:string;
 vehicleContext?:{variantId:string;year:number;fuel?:string;engine?:number;registration?:string};
 compatibility?:CompatibilityInfo|null;
}){
 const [state,action,pending]=useActionState(startCheckout,initial);
 const maxQuantity=Math.max(1,Math.min(stock,10));
 const uncertainFit=Boolean(vehicleContext&&compatibility&&(compatibility.level==="family_match"||compatibility.level==="unverified"));
 const verifiedCounts=compatibility?.verifiedFit;
 const fitEvidenceCount=(verifiedCounts?.exactFitCount??0)+(verifiedCounts?.modifiedFitCount??0)+(verifiedCounts?.didNotFitCount??0);

 if(ownListing)return <div className="mt-5 rounded-2xl bg-[#eef1eb] p-4 text-sm font-bold text-[#56625d]">This is your own listing, so purchase controls are hidden.</div>;

 if(!signedIn)return <Link href={"/account?reason=signin-required&returnTo="+encodeURIComponent(returnTo)} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-5 py-3.5 font-black text-white"><CreditCard size={18}/>Sign in to buy</Link>;

 return <form action={action} className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
  <input type="hidden" name="partId" value={partId}/>
  <input type="hidden" name="returnTo" value={returnTo}/>
  {vehicleContext&&<><input type="hidden" name="vehicleVariantId" value={vehicleContext.variantId}/><input type="hidden" name="vehicleYear" value={vehicleContext.year}/>{vehicleContext.fuel&&<input type="hidden" name="vehicleFuel" value={vehicleContext.fuel}/>} {vehicleContext.engine!==undefined&&<input type="hidden" name="vehicleEngine" value={vehicleContext.engine}/>} {vehicleContext.registration&&<input type="hidden" name="vehicleRegistration" value={vehicleContext.registration}/>}</>}
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

  {vehicleContext&&compatibility&&<div className={"mt-3 rounded-xl border p-3 "+(compatibility.level==="confirmed"?"border-emerald-200 bg-emerald-50 text-emerald-950":compatibility.level==="buyer_verified"?"border-cyan-200 bg-cyan-50 text-cyan-950":"border-amber-200 bg-amber-50 text-amber-950")}>
   <div className="flex items-start gap-2">{compatibility.level==="confirmed"?<CheckCircle2 size={18} className="mt-0.5 shrink-0"/>:compatibility.level==="buyer_verified"?<UsersRound size={18} className="mt-0.5 shrink-0"/>:<AlertTriangle size={18} className="mt-0.5 shrink-0"/>}<div><p className="text-sm font-black">{compatibility.label}</p><p className="mt-1 text-xs leading-5">{compatibility.detail}</p>{fitEvidenceCount>0&&<p className="mt-1 text-[11px] leading-5">{verifiedCounts?.exactFitCount??0} exact fit · {verifiedCounts?.modifiedFitCount??0} modified fit · {verifiedCounts?.didNotFitCount??0} did not fit from completed SecondPart purchases.</p>}</div></div>
  </div>}
  {uncertainFit&&<label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950"><input required type="checkbox" name="compatibilityAcknowledged" value="1" className="mt-1 h-5 w-5 accent-[#173c31]"/><span>I understand that compatibility with my selected vehicle is not confirmed and I will verify OE/OEM number and seller evidence before ordering.</span></label>}
  {!vehicleContext&&<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-950"><AlertTriangle size={16} className="mr-1 inline"/>No vehicle is linked to this checkout, so SecondPart cannot show vehicle-specific compatibility confidence or collect verified fitment evidence for this purchase.</div>}
  {vehicleContext&&<p className="mt-3 rounded-xl bg-[#eef1eb] p-3 text-xs font-bold text-[#56625d]">This purchase will be linked to your selected vehicle so SecondPart can ask for verified fitment feedback after the transaction.</p>}
  {!checkoutReady&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Checkout is not available for this seller yet.</p>}
  {state.message&&<p role="status" className={"mt-3 rounded-xl p-3 text-sm font-bold "+(state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800")}>{state.message}</p>}

  <button disabled={!checkoutReady||pending||stock<1} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4f44d] px-5 py-3.5 font-black text-[#173c31] disabled:cursor-not-allowed disabled:opacity-50"><CreditCard size={18}/>{pending?"Opening secure checkout…":"Buy now"}</button>
  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#63706a]"><LockKeyhole size={13}/>Secure marketplace checkout. Seller transfer is released through the SecondPart transaction flow.</p>
 </form>;
}
