"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {completeNativeAuthReturn} from "@/app/auth/native-return/actions";
import {coordinateNativeAccountChange} from "@/lib/native-push";
export function NativeAuthContinuation({flow,query}:{flow:"callback"|"confirm";query:string}){
 const router=useRouter();
 const [failed,setFailed]=useState(false);
 const [retry,setRetry]=useState(0);
 const attempt=useRef<{key:string;promise:ReturnType<typeof completeNativeAuthReturn>}|null>(null);
 useEffect(()=>{
  let cancelled=false;
  const key=`${flow}:${query}:${retry}`;
  // StrictMode reuses the provider attempt but gives each effect its own delivery lifetime.
  if(attempt.current?.key!==key)attempt.current={key,promise:coordinateNativeAccountChange(()=>completeNativeAuthReturn(flow,query))};
  void attempt.current.promise.then(result=>{
   if(cancelled)return;
   if(!result.ok){setFailed(true);return;}
   router.replace(result.href);router.refresh();
  }).catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;};
 },[flow,query,retry,router]);
 return <section className="rounded-2xl border border-black/10 bg-white p-6"><h1 className="text-2xl font-black">Returning to SecondPart</h1><p role="status" className="mt-3 text-sm">{failed?"We could not complete your return. Check your connection and try again.":"Please wait while we check your account."}</p>{failed&&<button type="button" className="mt-4 rounded-xl bg-[#173c31] px-4 py-2.5 font-bold text-white" onClick={()=>{setFailed(false);setRetry(value=>value+1);}}>Try again</button>}</section>;
}
