"use client";

import { useActionState } from "react";
import { changeCurrentPassword } from "@/app/account/security/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function AccountPasswordForm(){
 const [state,action,pending]=useActionState(changeCurrentPassword,initial);
 return <form action={action} className="mt-5 grid gap-4 sm:max-w-xl">
  <label className="block text-sm font-bold">Current password<input name="currentPassword" type="password" required autoComplete="current-password" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]"/></label>
  <label className="block text-sm font-bold">New password<input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]"/></label>
  <label className="block text-sm font-bold">Confirm new password<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]"/></label>
  {state.message&&<p role="status" className={`rounded-xl p-3 text-sm font-bold ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
  <button disabled={pending} className="w-full rounded-xl bg-[#173c31] px-4 py-3.5 font-black text-white disabled:opacity-50 sm:w-auto">{pending?"Updating…":"Change password"}</button>
 </form>;
}
