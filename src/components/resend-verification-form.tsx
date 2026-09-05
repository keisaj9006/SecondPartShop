"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resendConfirmation } from "@/app/auth/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function ResendVerificationForm(){
 const [state,action,pending]=useActionState(resendConfirmation,initial);
 return <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-xl">
  <p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Email verification</p>
  <h1 className="mt-3 text-3xl font-black tracking-tight">Confirm your email</h1>
  <p className="mt-2 text-sm leading-6 text-[#63706a]">If your confirmation link expired or never arrived, request a fresh one below.</p>
  <form action={action} className="mt-6">
   <label className="block text-sm font-bold">Email address<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="you@example.co.uk"/></label>
   {state.message&&<p role="status" className={`mt-4 rounded-xl p-3 text-sm ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
   <button disabled={pending} className="mt-6 w-full rounded-xl bg-[#173c31] py-3.5 font-black text-white disabled:opacity-50">{pending?"Sending…":"Resend confirmation email"}</button>
  </form>
  <Link href="/account" className="mt-5 inline-block text-sm font-black underline">Back to sign in</Link>
 </div>;
}
