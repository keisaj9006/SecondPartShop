"use client";

import { useState } from "react";
import { Check,Copy } from "lucide-react";

export function CopyInviteLink({path}:{path:string}){
 const [copied,setCopied]=useState(false);
 return <button type="button" onClick={async()=>{
  try{
   await navigator.clipboard.writeText(window.location.origin+path);
   setCopied(true);
   window.setTimeout(()=>setCopied(false),1600);
  }catch{}
 }} className="inline-flex items-center gap-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-black">{copied?<Check size={13}/>:<Copy size={13}/>} {copied?"Copied":"Copy invite link"}</button>;
}
