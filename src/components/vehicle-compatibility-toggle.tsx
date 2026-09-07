"use client";

import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { Check,CheckCircle2,Layers3 } from "lucide-react";

export function VehicleCompatibilityToggle({vehicleLabel,checked}:{vehicleLabel:string;checked:boolean}){
 const router=useRouter();
 const pathname=usePathname();
 const searchParams=useSearchParams();

 const change=(next:boolean)=>{
  const params=new URLSearchParams(searchParams.toString());
  params.set("fit",next?"1":"0");
  params.delete("page");
  router.push(`${pathname}?${params.toString()}#marketplace`,{scroll:false});
 };

 return <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#173c31]/15 bg-white p-4 shadow-sm">
  <input
   type="checkbox"
   checked={checked}
   onChange={event=>change(event.target.checked)}
   className="peer sr-only"
  />
  <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-[#173c31] bg-white text-white transition peer-checked:bg-[#173c31]">
   {checked&&<Check size={16} strokeWidth={3}/>}
  </span>
  <span className="min-w-0 flex-1">
   <span className="flex items-center gap-2 text-sm font-black text-[#173c31]">
    {checked?<CheckCircle2 size={17}/>:<Layers3 size={17}/>}
    Show only parts that fit this vehicle
   </span>
   <span className="mt-1 block text-xs leading-5 text-[#63706a]">
    {checked
     ?`Only confirmed or same-family matches for ${vehicleLabel} are shown.`
     :`Showing the full marketplace, including unverified parts that may not fit ${vehicleLabel}. Compatibility labels stay visible.`}
   </span>
  </span>
 </label>;
}
