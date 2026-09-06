"use client";

import { useActionState } from "react";
import { updateMemberProfile } from "@/app/account/profile/actions";
import type { ActionState,Profile } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function MemberProfileForm({profile}:{profile:Profile}){
  const [state,action,pending]=useActionState(updateMemberProfile,initial);
  const input="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";
  return <form action={action} className="mt-7 grid gap-5 rounded-3xl border border-black/10 bg-white p-6 sm:grid-cols-2">
    <label className="text-sm font-bold">Display name
      <input required minLength={2} maxLength={100} name="displayName" defaultValue={profile.displayName} className={input}/>
    </label>
    <label className="text-sm font-bold">Username
      <div className="relative"><span className="absolute left-4 top-[22px] text-[#63706a]">@</span><input required minLength={3} maxLength={32} pattern="[a-z0-9][a-z0-9-]{2,31}" name="handle" defaultValue={profile.handle} className={`${input} pl-8`}/></div>
      <small className="mt-1 block font-normal text-[#63706a]">Lowercase letters, numbers and hyphens. This is public.</small>
    </label>
    <label className="text-sm font-bold sm:col-span-2">Public bio
      <textarea maxLength={500} rows={4} name="bio" defaultValue={profile.bio??""} className={input} placeholder="Tell buyers and sellers a little about yourself."/>
    </label>
    <label className="text-sm font-bold sm:col-span-2">Phone number <span className="font-normal text-[#63706a]">(private)</span>
      <input maxLength={50} name="phone" defaultValue={profile.phone??""} className={input}/>
      <small className="mt-1 block font-normal text-[#63706a]">Never displayed on your public member profile.</small>
    </label>
    {state.message&&<p className={`text-sm font-bold sm:col-span-2 ${state.status==="success"?"text-emerald-700":"text-red-700"}`}>{state.message}</p>}
    <button disabled={pending} className="rounded-xl bg-[#173c31] px-5 py-3 font-black text-white disabled:opacity-60 sm:col-span-2">{pending?"Saving…":"Save profile"}</button>
  </form>;
}
