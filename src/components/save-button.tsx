"use client";

import { useEffect,useRef,useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleSavedPart } from "@/app/saved/actions";
import { safeInternalPath } from "@/lib/navigation";

const savedPartUpdateEvent="secondpart:saved-part-update";
const saveErrorMessage="We couldn't update your saved parts. Please try again.";

type SavedPartUpdate={partId:string;saved:boolean;viewerId:string|null};
type Feedback={kind:"idle"|"pending"|"success"|"error";message:string;viewerId:string|null};

function currentReturnTo(){
 if(typeof window==="undefined")return "/";
 return safeInternalPath(`${window.location.pathname}${window.location.search}${window.location.hash}`,"/");
}

export function SaveButton({partId,viewerId,initialSaved=false,compact=false}:{partId:string;viewerId:string|null;initialSaved?:boolean;compact?:boolean}){
 const [savedState,setSavedState]=useState({saved:initialSaved,initialSaved,viewerId});
 const [feedback,setFeedback]=useState<Feedback>({kind:"idle",message:"",viewerId});
 const pendingRef=useRef(false);
 const mountedRef=useRef(false);
 const [transitionPending,startTransition]=useTransition();
 const router=useRouter();
 if(savedState.viewerId!==viewerId||savedState.initialSaved!==initialSaved)setSavedState({saved:initialSaved,initialSaved,viewerId});
 const saved=savedState.viewerId===viewerId&&savedState.initialSaved===initialSaved?savedState.saved:initialSaved;
 const currentFeedback=feedback.viewerId===viewerId?feedback:{kind:"idle" as const,message:"",viewerId};
 const pending=transitionPending;
 const setSaved=(value:boolean)=>setSavedState(current=>({...current,saved:value}));

 useEffect(()=>{
  mountedRef.current=true;
  return ()=>{mountedRef.current=false;};
 },[]);

 useEffect(()=>{
  const synchronize=(event:Event)=>{
   const update=(event as CustomEvent<SavedPartUpdate>).detail;
   if(!update||update.partId!==partId||update.viewerId!==viewerId)return;
   setSaved(update.saved);
   setFeedback({kind:"success",message:update.saved?"Part saved.":"Part removed from saved parts.",viewerId});
  };
  window.addEventListener(savedPartUpdateEvent,synchronize);
  return ()=>window.removeEventListener(savedPartUpdateEvent,synchronize);
 },[partId,viewerId]);

 const activate=()=>{
  if(pendingRef.current)return;
  pendingRef.current=true;
  const activationViewerId=viewerId;
  setFeedback({kind:"pending",message:saved?"Removing saved part…":"Saving part…",viewerId:activationViewerId});
  startTransition(async()=>{
   try{
    const result=await toggleSavedPart(partId);
    if(!mountedRef.current)return;
    if(result.authRequired){
     router.push(`/account?returnTo=${encodeURIComponent(currentReturnTo())}`);
     return;
    }
    if(!result.ok){
     setFeedback({kind:"error",message:saveErrorMessage,viewerId:activationViewerId});
     return;
    }
    const update:SavedPartUpdate={partId,saved:result.saved,viewerId:activationViewerId};
    setSaved(update.saved);
    setFeedback({kind:"success",message:update.saved?"Part saved.":"Part removed from saved parts.",viewerId:activationViewerId});
    window.dispatchEvent(new CustomEvent<SavedPartUpdate>(savedPartUpdateEvent,{detail:update}));
    router.refresh();
   }catch{
    if(!mountedRef.current)return;
    setFeedback({kind:"error",message:saveErrorMessage,viewerId:activationViewerId});
   }finally{
    pendingRef.current=false;
   }
  });
 };

 const label=pending?(saved?"Removing saved part":"Saving part"):(saved?"Remove from saved parts":"Save part");
 const buttonClass=compact
  ?`rounded-full p-2.5 shadow-sm ${saved?"bg-[#173c31] text-white":"bg-white text-[#173c31]"} ${currentFeedback.kind==="error"?"ring-2 ring-red-600":""}`
  :`flex w-full items-center justify-center gap-2 rounded-xl border border-black/15 px-5 py-3 font-bold ${saved?"bg-[#173c31] text-white":"bg-white"}`;

 return <span className={compact?"relative inline-grid":"grid"}>
  <button type="button" disabled={pending} aria-label={label} aria-pressed={saved} aria-busy={pending} title={compact&&currentFeedback.kind==="error"?currentFeedback.message:undefined} onClick={activate} className={`${buttonClass} disabled:cursor-wait disabled:opacity-70`}>
   <Heart size={18} fill={saved?"currentColor":"none"}/>{!compact&&(pending?label:(saved?"Saved":"Save part"))}
  </button>
  {compact&&currentFeedback.kind==="error"&&<span aria-hidden="true" className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-44 rounded-lg bg-white px-3 py-2 text-center text-xs font-bold text-red-800 shadow-lg ring-1 ring-red-200">Save failed. Try again.</span>}
  <span role="status" aria-live="polite" className={!compact&&currentFeedback.kind==="error"?"mt-2 text-sm font-bold text-red-700":"sr-only"}>{currentFeedback.message}</span>
 </span>;
}
