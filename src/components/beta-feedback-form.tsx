"use client";

import { useActionState } from "react";
import { createBetaFeedback } from "@/app/beta-feedback/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function BetaFeedbackForm(){
 const [state,action,pending]=useActionState(createBetaFeedback,initial);
 return <form action={action} className="mt-6 grid gap-5">
  <div className="grid gap-4 sm:grid-cols-2">
   <label className="text-sm font-bold">Where did it happen?
    <select name="category" required defaultValue="" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]">
     <option value="" disabled>Choose an area</option><option value="navigation">Navigation</option><option value="search">Search & filters</option><option value="compatibility">Vehicle compatibility</option><option value="checkout">Checkout / order</option><option value="seller">Seller tools</option><option value="notifications">Notifications</option><option value="account">Account</option><option value="performance">Speed / performance</option><option value="other">Other</option>
    </select>
   </label>
   <label className="text-sm font-bold">Severity
    <select name="severity" required defaultValue="" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]">
     <option value="" disabled>Choose severity</option><option value="blocker">Blocker — I cannot continue</option><option value="major">Major — important flow is broken</option><option value="minor">Minor — usable but wrong/confusing</option><option value="suggestion">Suggestion / improvement</option>
    </select>
   </label>
  </div>

  <label className="text-sm font-bold">Screen or route <span className="font-normal text-[#63706a]">(optional)</span>
   <input name="area" maxLength={160} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Example: Home, Garage, /checkout, Seller dashboard"/>
  </label>

  <label className="text-sm font-bold">Short summary
   <input name="summary" required minLength={5} maxLength={180} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Example: Back navigation freezes after opening Garage"/>
  </label>

  <label className="text-sm font-bold">Steps to reproduce
   <textarea name="steps" required minLength={10} maxLength={700} rows={5} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="1. Open…&#10;2. Tap…&#10;3. Go back…"/>
  </label>

  <div className="grid gap-4 sm:grid-cols-2">
   <label className="text-sm font-bold">Expected result <span className="font-normal text-[#63706a]">(optional)</span>
    <textarea name="expected" maxLength={320} rows={4} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="What did you expect to happen?"/>
   </label>
   <label className="text-sm font-bold">What actually happened?
    <textarea name="actual" required maxLength={320} rows={4} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Describe what you saw instead."/>
   </label>
  </div>

  <p className="text-xs leading-5 text-[#63706a]">Please send one issue per report. Do not include passwords, payment card details, private API keys or other sensitive information.</p>
  {state.message&&<p role="status" className={`rounded-xl p-3 text-sm font-bold ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
  <button disabled={pending} className="w-fit rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{pending?"Submitting…":"Send beta report"}</button>
 </form>;
}
