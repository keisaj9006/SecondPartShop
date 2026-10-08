"use client";

import Link from "next/link";

export function GarageVehicleUseControl({isCurrent,fitOnly,fitHref,onFitChange,onUse}:{isCurrent:boolean;fitOnly:boolean;fitHref:string;onFitChange:(fitOnly:boolean)=>void;onUse:()=>void}){
 if(!isCurrent)return <Link href={fitHref} onClick={onUse} className="flex min-h-12 items-center justify-center rounded-xl bg-[#d4f44d] px-4 py-3 text-center text-sm font-black">Use this vehicle</Link>;
 return <div className="mt-5 grid gap-3">
  <p className="w-fit rounded-full bg-[#173c31] px-3 py-1.5 text-xs font-black uppercase tracking-[.12em] text-[#d4f44d]">Current vehicle</p>
  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${fitOnly?"border-[#173c31] bg-[#f7faef] ring-2 ring-[#d4f44d]/50":"border-black/10 bg-white"}`}>
   <input
    aria-label="Show only parts that fit this vehicle"
    type="checkbox"
    checked={fitOnly}
    onChange={event=>onFitChange(event.target.checked)}
    className="mt-1 h-5 w-5 shrink-0 accent-[#173c31]"
   />
   <span>
    <strong className="block text-sm text-[#173c31]">Show only parts that fit this vehicle</strong>
    <small className="mt-1 block leading-5 text-[#63706a]">
     {fitOnly?"Only confirmed or same-family matches will be shown.":"Show the full marketplace and keep compatibility labels visible."}
    </small>
   </span>
  </label>
 </div>;
}
