"use client";

import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { useState,useTransition } from "react";
import { Check,CheckCircle2,Layers3 } from "lucide-react";
import { resetMarketplacePagination } from "@/lib/marketplace-navigation";

export function VehicleCompatibilityToggle({vehicleLabel,checked}:{vehicleLabel:string;checked:boolean}){
 const router=useRouter();
 const pathname=usePathname();
 const searchParams=useSearchParams();
 const [optimisticChecked,setOptimisticChecked]=useState(checked);
 const [isPending,startTransition]=useTransition();

 const visualChecked=isPending?optimisticChecked:checked;

 const change=(next:boolean)=>{
  setOptimisticChecked(next);
  const params=new URLSearchParams(searchParams.toString());
  params.set("fit",next?"1":"0");
  resetMarketplacePagination(params);
  startTransition(()=>router.push(`${pathname}?${params.toString()}#marketplace`,{scroll:false}));
 };

 return <label aria-busy={isPending} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition ${visualChecked?"border-[#173c31] bg-[#f7faef] ring-2 ring-[#d4f44d]/50":"border-[#173c31]/15 bg-white"} ${isPending?"opacity-85":""}`}>
  <input
   type="checkbox"
   checked={visualChecked}
   onChange={event=>change(event.target.checked)}
   className="peer sr-only"
  />
  <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-[#173c31] bg-white text-white transition peer-checked:bg-[#173c31]">
   {visualChecked&&<Check size={16} strokeWidth={3}/>}
  </span>
  <span className="min-w-0 flex-1">
   <span className="flex items-center gap-2 text-sm font-black text-[#173c31]">
    {visualChecked?<CheckCircle2 size={17}/>:<Layers3 size={17}/>}
    Show only parts that fit this vehicle
   </span>
   <span className="mt-1 block text-xs leading-5 text-[#63706a]">
    {visualChecked
     ?`Only confirmed or same-family matches for ${vehicleLabel} are shown.`
     :`Showing the full marketplace, including unverified parts that may not fit ${vehicleLabel}. Compatibility labels stay visible.`}
   </span>
  </span>
 </label>;
}
