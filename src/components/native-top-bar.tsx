"use client";

import Link from "next/link";
import {Bell,Heart,Search} from "lucide-react";

export function NativeTopBar(){
 return <header className="native-persistent-topbar sticky top-0 z-[70] border-b border-black/10 bg-[#fbfcfa]/96 px-3 pb-2 pt-[calc(8px+env(safe-area-inset-top))] shadow-[0_8px_24px_rgba(18,34,29,.05)] backdrop-blur-xl">
  <div className="mx-auto flex min-h-12 max-w-lg items-center justify-between gap-3">
   <Link href="/" prefetch className="flex min-w-0 items-center gap-2 text-[20px] font-black tracking-[-.04em]">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#173c31] text-[#d4f44d]">S</span>
    <span className="truncate">SecondPart</span>
   </Link>
   <nav aria-label="Quick actions" className="flex shrink-0 items-center gap-0.5">
    <Link aria-label="Search parts" href="/#marketplace" prefetch className="grid h-11 w-11 place-items-center rounded-full active:bg-black/5"><Search size={19}/></Link>
    <Link aria-label="Saved parts" href="/saved" prefetch className="grid h-11 w-11 place-items-center rounded-full active:bg-black/5"><Heart size={19}/></Link>
    <Link aria-label="Notifications" href="/notifications" prefetch className="grid h-11 w-11 place-items-center rounded-full active:bg-black/5"><Bell size={19}/></Link>
   </nav>
  </div>
 </header>;
}
