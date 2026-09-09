"use client";

import Link from "next/link";
import { usePathname,useRouter } from "next/navigation";
import { useEffect,useMemo,useState } from "react";
import { CarFront,Home,MessageSquareText,PackageCheck,UserRound } from "lucide-react";

const items=[
 {href:"/",label:"Home",icon:Home,active:(path:string)=>path==="/"},
 {href:"/garage",label:"Garage",icon:CarFront,active:(path:string)=>path.startsWith("/garage")},
 {href:"/account/orders",label:"Purchases",icon:PackageCheck,active:(path:string)=>path.startsWith("/account/orders")},
 {href:"/inbox",label:"Inbox",icon:MessageSquareText,active:(path:string)=>path.startsWith("/inbox")},
 {href:"/account",label:"Account",icon:UserRound,active:(path:string)=>(path.startsWith("/account")&&!path.startsWith("/account/orders"))||path.startsWith("/dashboard")||path.startsWith("/sell")}
];

export function MobileBottomNav(){
 const pathname=usePathname();
 const router=useRouter();
 const [pendingNavigation,setPendingNavigation]=useState<{href:string;fromPath:string}|null>(null);

 const currentHref=useMemo(()=>{
  const current=items.find(item=>item.active(pathname));
  return current?.href??null;
 },[pathname]);

 useEffect(()=>{
  // Root tabs are the highest-frequency navigation in the Android app.
  // Force a full prefetch of each destination after every committed route so
  // dynamic Server Component pages are already warm before the next tap.
  const warm=()=>{for(const item of items)router.prefetch(item.href);};
  warm();

  const id=typeof window.requestIdleCallback==="function"
   ?window.requestIdleCallback(warm,{timeout:1200})
   :window.setTimeout(warm,250);

  return()=>{
   if(typeof window.cancelIdleCallback==="function"&&typeof id==="number")window.cancelIdleCallback(id);
   else window.clearTimeout(id as number);
  };
 },[pathname,router]);

 const selectedHref=pendingNavigation&&pendingNavigation.fromPath===pathname?pendingNavigation.href:currentHref;

 return <nav aria-label="Mobile navigation" className="app-bottom-nav fixed inset-x-0 bottom-0 z-[80] border-t border-black/10 bg-[#fbfcfa]/96 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(18,34,29,.08)] backdrop-blur-xl md:hidden">
  <div className="mx-auto grid max-w-lg grid-cols-5">
   {items.map(item=>{
    const Icon=item.icon;
    const active=selectedHref===item.href;
    return <Link
     key={item.href}
     href={item.href}
     prefetch={true}
     aria-current={active?"page":undefined}
     onPointerDown={()=>{if(item.href!==currentHref)router.prefetch(item.href);}}
     onClick={()=>{if(item.href!==currentHref)setPendingNavigation({href:item.href,fromPath:pathname});}}
     className={"flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-bold transition "+(active?"text-[#173c31]":"text-[#63706a]")}
    >
     <span className={"grid h-8 w-10 place-items-center rounded-xl transition "+(active?"bg-[#d4f44d]":"bg-transparent")}><Icon size={19} strokeWidth={active?2.7:2}/></span>
     <span className="truncate">{item.label}</span>
    </Link>;
   })}
  </div>
 </nav>;
}
