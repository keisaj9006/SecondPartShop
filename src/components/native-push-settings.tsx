"use client";
import {useEffect,useState} from "react";
import {disableHostedPush,prepareHostedPush,confirmHostedPush,hostedPushStatus} from "@/app/account/push-actions";
import {getNativePush,nativePushAppId,registerNativePush,runNativePushWork} from "@/lib/native-push";

type State={enabled:boolean;busy:boolean;message:string};
const preferenceKey=(userId:string)=>`secondpart.push.enabled.${userId}`;
const remember=(userId:string,enabled:boolean)=>{try{localStorage.setItem(preferenceKey(userId),String(enabled));}catch{}};
const optedIn=(userId:string)=>{try{return localStorage.getItem(preferenceKey(userId))==="true";}catch{return false;}};
async function enableForUser(userId:string,requestPermission:boolean){
 return runNativePushWork(async()=>{
  const appId=await nativePushAppId();
  const token=await registerNativePush(requestPermission);
  const prepared=await prepareHostedPush(userId,{token,appId});
  if(!prepared.ok)throw new Error(prepared.message);
  const result=await confirmHostedPush(userId,prepared.version);
  if(!result.ok)throw new Error(result.message);
  remember(userId,true);
  return result;
 });
}
export function NativePushSettings({userId}:{userId:string}){
 const [state,setState]=useState<State|null>(null);
 useEffect(()=>{
  const push=getNativePush();
  if(!push)return;
  let cancelled=false;
  let knownEnabled=false;
  void (async()=>{
   try{
    const result=await hostedPushStatus(userId);
    if(cancelled)return;
    if(!result.ok){setState({enabled:false,busy:false,message:result.message});return;}
    knownEnabled=result.enabled;
    const {receive}=await push.checkPermissions();
    if(cancelled)return;
    if(receive==="granted"&&optedIn(userId)){
     setState({enabled:result.enabled,busy:true,message:"Restoring notifications…"});
     const restored=await enableForUser(userId,false);
     if(!cancelled)setState({enabled:restored.enabled,busy:false,message:"Notifications enabled for this device."});
    }else{
     if(result.enabled&&receive!=="granted"){
      const disabled=await runNativePushWork(()=>disableHostedPush(userId));
      if(!disabled.ok)throw new Error(disabled.message);
     }
     if(!cancelled)setState({enabled:result.enabled&&receive==="granted",busy:false,message:receive==="denied"?"Allow notifications in Android settings, then select Enable.":""});
    }
   }catch{
    if(!cancelled)setState({enabled:knownEnabled,busy:false,message:"Could not refresh notifications. You can disable them or try again."});
   }
  })();
  return()=>{cancelled=true;};
 },[userId]);
 if(!state)return null;
 const change=async()=>{
  setState({...state,busy:true,message:""});
  try{
   if(state.enabled){
    await runNativePushWork(async()=>{
     const result=await disableHostedPush(userId);
     if(!result.ok)throw new Error(result.message);
     remember(userId,false);
     // Backend association is already disabled even if the native call fails.
     try{await getNativePush()?.unregister();}catch{}
    });
    setState({enabled:false,busy:false,message:"Notifications disabled for this device."});
   }else{
    await enableForUser(userId,true);
    setState({enabled:true,busy:false,message:"Notifications enabled for this device."});
   }
  }catch(error){setState({...state,busy:false,message:error instanceof Error?error.message:"Could not update notifications. Try again."});}
 };
 return <section className="mt-5 rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4" aria-label="Android notifications">
  <div className="flex items-center justify-between gap-4"><div><h2 className="font-black">Notifications on this device</h2><p className="mt-1 text-sm text-[#63706a]">{state.enabled?"Enabled":"Disabled"} · Order updates, messages and saved-search alerts.</p></div><button type="button" disabled={state.busy} onClick={()=>void change()} className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{state.busy?"Please wait…":state.enabled?"Disable":"Enable"}</button></div>
  {state.message&&<p role="status" className="mt-3 text-sm text-[#63706a]">{state.message}</p>}
 </section>;
}
