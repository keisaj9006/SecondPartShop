"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "@/app/auth/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function ResetPasswordForm(){
 const [state,action,pending]=useActionState(updatePassword,initial);
 return <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-xl">
  <p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Account recovery</p>
  <h1 className="mt-3 text-3xl font-black tracking-tight">Choose a new password</h1>
  <p className="mt-2 text-sm leading-6 text-[#63706a]">Use at least 8 characters. Your reset link must still be active for this step to work.</p>
  <form action={action} className="mt-6">
   <label className="block text-sm font-bold">New password<input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]"/></label>
   <label className="mt-4 block text-sm font-bold">Confirm new password<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]"/></label>
   {state.message&&<p role="status" className={`mt-4 rounded-xl p-3 text-sm ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
   <button disabled={pending} className="mt-6 w-full rounded-xl bg-[#173c31] py-3.5 font-black text-white disabled:opacity-50">{pending?"Updating…":"Update password"}</button>
  </form>
  <Link href="/auth/forgot-password" className="mt-5 inline-block text-sm font-black underline">Request a new reset link</Link>
 </div>;
}
