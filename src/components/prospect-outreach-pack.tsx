"use client";

import { useEffect,useState } from "react";
import { Check,Copy,Mail,PhoneCall } from "lucide-react";

const copyText=async(value:string)=>{
 await navigator.clipboard.writeText(value);
};

export function ProspectOutreachPack({businessName,invitePath,publicEmail}:{businessName:string;invitePath:string;publicEmail:string|null}){
 const [copied,setCopied]=useState("");
 const [invite,setInvite]=useState(invitePath);
 useEffect(()=>{setInvite(window.location.origin+invitePath);},[invitePath]);
 const subject="Founding Seller invitation — SecondPart";
 const firstEmail=`Hi ${businessName} team,

I'm Joanna from SecondPart. We're building a UK marketplace focused on used and recycled vehicle parts, with vehicle compatibility, structured seller onboarding and tools for bringing existing inventory across efficiently.

We're inviting a small group of established breakers, ATFs and parts businesses to help shape the seller experience before the wider marketplace launch.

SecondPart can support bulk CSV inventory, AI-assisted listing drafts, donor vehicle / fitment evidence and a controlled review process before imported listings go live.

If this is relevant to your business, here is your Founding Seller invitation:
${invite}

Would you be open to a short conversation about your current inventory workflow and what would make migration worthwhile?

Best,
Joanna
SecondPart`;

 const followUp=`Hi ${businessName} team,

Just following up on my SecondPart Founding Seller invitation.

We're specifically speaking with established recycled-parts businesses about inventory migration, compatibility data and the seller workflow before wider launch.

Your invitation link is here:
${invite}

If this isn't relevant, no problem — just let me know and I won't keep following up.

Best,
Joanna
SecondPart`;

 const callOpener=`Hi, I'm Joanna from SecondPart. We're building a UK marketplace for used and recycled vehicle parts and we're currently inviting a small group of established breakers and parts businesses into our Founding Seller Programme. I wanted to understand how you manage your current parts inventory and whether a bulk-import and compatibility-led marketplace could be useful for ${businessName}.`;

 const doCopy=async(key:string,value:string)=>{
  try{
   await copyText(value);
   setCopied(key);
   window.setTimeout(()=>setCopied(current=>current===key?"":current),1400);
  }catch{}
 };

 return <div className="mt-3 rounded-xl bg-[#f4f7f2] p-3">
  <p className="text-xs font-black">Outreach pack</p>
  <p className="mt-1 text-[10px] leading-4 text-[#63706a]">Copying a template does not mark the prospect as contacted. Log the activity only after you actually send or call.</p>
  <div className="mt-2 flex flex-wrap gap-2">
   <button type="button" onClick={()=>void doCopy("email",`Subject: ${subject}\n\n${firstEmail}`)} className="inline-flex items-center gap-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-black">{copied==="email"?<Check size={13}/>:<Copy size={13}/>} Email 1</button>
   <button type="button" onClick={()=>void doCopy("follow",followUp)} className="inline-flex items-center gap-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-black">{copied==="follow"?<Check size={13}/>:<Copy size={13}/>} Follow-up</button>
   <button type="button" onClick={()=>void doCopy("call",callOpener)} className="inline-flex items-center gap-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-black">{copied==="call"?<Check size={13}/>:<PhoneCall size={13}/>} Call opener</button>
   {publicEmail&&<a href={`mailto:${publicEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(firstEmail)}`} className="inline-flex items-center gap-1 rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white"><Mail size={13}/>Open email</a>}
  </div>
 </div>;
}
