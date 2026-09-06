"use client";

import { useActionState } from "react";
import { updateSellerProfile } from "@/app/dashboard/actions";
import type { ActionState,Seller } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function SellerProfileEditForm({seller}:{seller:Seller}){
 const [state,action,pending]=useActionState(updateSellerProfile,initial);
 const input="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";
 return <form action={action} className="mt-7 grid gap-5 rounded-3xl border border-black/10 bg-white p-6 sm:grid-cols-2">
  {seller.verified&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:col-span-2"><p className="font-black">Verified business profile</p><p className="mt-1 leading-6 text-amber-900/75">Changing seller type, seller/business name, town/city or postcode automatically removes the verified badge until the updated identity is reviewed again.</p></div>}
  <label className="text-sm font-bold">Seller type
   <select name="sellerType" defaultValue={seller.sellerType} className={input}>
    <option value="private">Private seller</option>
    <option value="business">Business / garage / breaker</option>
   </select>
   <small className="mt-1 block font-normal text-[#63706a]">Shown publicly so buyers understand who they are buying from.</small>
  </label>
  <label className="text-sm font-bold">Seller / business name<input required minLength={2} maxLength={140} name="businessName" defaultValue={seller.businessName} className={input}/></label>
  <label className="text-sm font-bold">Town or city<input required maxLength={120} name="location" defaultValue={seller.location} className={input}/></label>
  <label className="text-sm font-bold">Postcode<input maxLength={20} name="postcode" defaultValue={seller.postcode??""} className={input}/></label>
  <label className="text-sm font-bold sm:col-span-2">About the seller<textarea required minLength={20} maxLength={2000} name="description" rows={6} defaultValue={seller.description} className={input}/></label>
  {state.message&&<p className={`text-sm font-bold sm:col-span-2 ${state.status==="success"?"text-emerald-700":"text-red-700"}`}>{state.message}</p>}
  <button disabled={pending} className="rounded-xl bg-[#173c31] px-5 py-3 font-black text-white disabled:opacity-60 sm:col-span-2">{pending?"Saving…":"Save seller profile"}</button>
 </form>;
}
