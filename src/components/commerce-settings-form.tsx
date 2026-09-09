"use client";

import { useActionState } from "react";
import { Banknote,Clock3,ShieldCheck } from "lucide-react";
import { updateCommerceSettings } from "@/app/admin/commerce/settings/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function CommerceSettingsForm({
 platformFeePercent,
 checkoutReservationMinutes,
 autoReleaseHours,
 unverifiedDeliveryReviewDays
}:{
 platformFeePercent:number;
 checkoutReservationMinutes:number;
 autoReleaseHours:number;
 unverifiedDeliveryReviewDays:number;
}){
 const [state,action,pending]=useActionState(updateCommerceSettings,initial);
 const input="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";

 return <form action={action} className="mt-7 grid gap-5">
  <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-center gap-2"><Banknote size={20}/><h2 className="text-xl font-black">Seller platform fee</h2></div>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">Deducted from the seller proceeds. The buyer checkout total is not increased by this setting.</p>
   <label className="mt-4 block text-sm font-bold">Fee (%)<input required type="number" min="0" max="25" step="0.01" name="platformFeePercent" defaultValue={platformFeePercent} className={input}/></label>
  </section>

  <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-center gap-2"><Clock3 size={20}/><h2 className="text-xl font-black">Checkout reservation</h2></div>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">How long a buyer can hold reserved stock while completing Stripe Checkout. Provider sessions also receive an additional webhook grace window before local stock recovery.</p>
   <label className="mt-4 block text-sm font-bold">Minutes<input required type="number" min="30" max="240" step="1" name="checkoutReservationMinutes" defaultValue={checkoutReservationMinutes} className={input}/></label>
  </section>

  <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-center gap-2"><ShieldCheck size={20}/><h2 className="text-xl font-black">Buyer-protection release window</h2></div>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">After the buyer confirms receipt without immediately accepting the item, seller funds become eligible after this period unless a return or dispute blocks them.</p>
   <label className="mt-4 block text-sm font-bold">Hours<input required type="number" min="12" max="168" step="1" name="autoReleaseHours" defaultValue={autoReleaseHours} className={input}/></label>
  </section>

  <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-center gap-2"><Clock3 size={20}/><h2 className="text-xl font-black">Silent-buyer delivery review</h2></div>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">For shipped orders with no buyer receipt confirmation and no trusted carrier delivery event, funds are never released from silence alone. After this many days from dispatch, the order becomes eligible for an administrator evidence review. Approval only starts the normal Buyer Protection release window.</p>
   <label className="mt-4 block text-sm font-bold">Days after dispatch<input required type="number" min="7" max="30" step="1" name="unverifiedDeliveryReviewDays" defaultValue={unverifiedDeliveryReviewDays} className={input}/></label>
  </section>

  {state.message&&<p role="status" className={"rounded-xl p-3 text-sm font-bold "+(state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800")}>{state.message}</p>}
  <button disabled={pending} className="rounded-xl bg-[#173c31] px-5 py-3.5 font-black text-white disabled:opacity-50">{pending?"Saving…":"Save commerce settings"}</button>
 </form>;
}
