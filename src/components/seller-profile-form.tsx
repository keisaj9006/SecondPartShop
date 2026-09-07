"use client";
import { useActionState,useState } from "react";
import { createSellerProfile } from "@/app/dashboard/actions";
import type { ActionState,SellerType } from "@/lib/types";
import { sellerBusinessKinds,sellerBusinessKindLabels } from "@/lib/seller-business";

const initial:ActionState={status:"idle"};

export function SellerProfileForm(){
 const [state,action,pending]=useActionState(createSellerProfile,initial);
 const [sellerType,setSellerType]=useState<SellerType>("private");
 const input="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";
 return <form action={action} className="mt-8 grid gap-5 rounded-3xl border border-black/10 bg-white p-6 sm:grid-cols-2">
  <label className="text-sm font-bold">Seller type
   <select name="sellerType" value={sellerType} onChange={event=>setSellerType(event.target.value as SellerType)} className={input}>
    <option value="private">Private seller</option>
    <option value="business">Business seller</option>
   </select>
  </label>
  <label className="text-sm font-bold">Business category<select name="businessKind" disabled={sellerType!=="business"} required={sellerType==="business"} defaultValue="" className={input}><option value="">Choose business type</option>{sellerBusinessKinds.map(kind=><option key={kind} value={kind}>{sellerBusinessKindLabels[kind]}</option>)}</select><small className="mt-1 block font-normal text-[#63706a]">Used for seller discovery, verification and the future garage / Buy + Fit network.</small></label>
  <label className="text-sm font-bold">Seller / business name<input required name="businessName" className={input}/></label>
  <label className="text-sm font-bold">Town or city<input required name="location" className={input}/></label>
  <label className="text-sm font-bold">Postcode<input name="postcode" className={input}/></label>
  <label className="text-sm font-bold sm:col-span-2">About the seller<textarea required minLength={20} maxLength={2000} name="description" rows={4} className={input}/></label>
  {state.message&&<p className="text-sm text-red-700 sm:col-span-2">{state.message}</p>}
  <button disabled={pending} className="rounded-xl bg-[#173c31] px-5 py-3 font-black text-white sm:col-span-2">{pending?"Creating…":"Create seller profile"}</button>
 </form>;
}
