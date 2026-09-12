"use client";

import Link,{useLinkStatus} from "next/link";
import { usePathname } from "next/navigation";
import { useCallback,useEffect,useMemo,useRef } from "react";
import { CarFront,Home,MessageSquareText,PackageCheck,UserRound } from "lucide-react";

const items=[
 {href:"/",label:"Home",icon:Home,active:(path:string)=>path==="/"},
 {href:"/garage",label:"Garage",icon:CarFront,active:(path:string)=>path.startsWith("/garage")},
 {href:"/account/orders",label:"Purchases",icon:PackageCheck,active:(path:string)=>path.startsWith("/account/orders")},
 {href:"/inbox",label:"Inbox",icon:MessageSquareText,active:(path:string)=>path.startsWith("/inbox")},
 {href:"/account",label:"Account",icon:UserRound,active:(path:string)=>(path.startsWith("/account")&&!path.startsWith("/account/orders"))||path.startsWith("/dashboard")||path.startsWith("/sell")}
];

function MobileNavContent({Icon,label,current,href,onPendingSettled}:{Icon:typeof Home;label:string;current:boolean;href:string;onPendingSettled:(href:string)=>void}){
 const {pending}=useLinkStatus();
 const wasPending=useRef(false);
 const highlighted=current||pending;

 useEffect(()=>{
  if(wasPending.current&&!pending)onPendingSettled(href);
  wasPending.current=pending;
 },[href,onPendingSettled,pending]);

 return <>
  <span aria-hidden="true" className={"grid h-8 w-10 place-items-center rounded-xl transition "+(highlighted?"bg-[#d4f44d]":"bg-transparent")}><Icon size={19} strokeWidth={highlighted?2.7:2}/></span>
  <span className={"truncate transition-colors "+(highlighted?"text-[#173c31]":"text-[#63706a]")}>{label}</span>
 </>;
}

export function MobileBottomNav(){
 const pathname=usePathname();
 const navigationTiming=useRef<{from:string;to:string;startedAt:number}|null>(null);

 const currentHref=useMemo(()=>{
  const current=items.find(item=>item.active(pathname));
  return current?.href??null;
 },[pathname]);

 useEffect(()=>{
  const timing=navigationTiming.current;
  if(timing&&pathname!==timing.from){
   const destination=items.find(item=>item.active(pathname))?.href;
   if(destination===timing.to){
    const elapsed=Math.round(performance.now()-timing.startedAt);
    console.info(`[SecondPart][nav] ${timing.from} -> ${pathname} ${elapsed}ms`);
    if(elapsed>750)console.warn(`[SecondPart][nav] Slow route ${timing.from} -> ${pathname}: ${elapsed}ms`);
   }
   navigationTiming.current=null;
  }
 },[pathname]);

 const handlePendingSettled=useCallback((href:string)=>{
  const timing=navigationTiming.current;
  if(timing?.to===href&&timing.from===pathname)navigationTiming.current=null;
 },[pathname]);

 return <nav aria-label="Mobile navigation" className="app-bottom-nav fixed inset-x-0 bottom-0 z-[80] border-t border-black/10 bg-[#fbfcfa]/96 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(18,34,29,.08)] backdrop-blur-xl md:hidden">
  <div className="mx-auto grid max-w-lg grid-cols-5">
   {items.map(item=>{
    const Icon=item.icon;
    const current=currentHref===item.href;
    return <Link
     key={item.href}
     href={item.href}
     prefetch={true}
     aria-current={current?"page":undefined}
     onNavigate={()=>{if(item.href!==currentHref)navigationTiming.current={from:pathname,to:item.href,startedAt:performance.now()};}}
     className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-bold transition"
    >
     <MobileNavContent Icon={Icon} label={item.label} current={current} href={item.href} onPendingSettled={handlePendingSettled}/>
    </Link>;
   })}
  </div>
 </nav>;
}
