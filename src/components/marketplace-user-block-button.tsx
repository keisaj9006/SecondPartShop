"use client";

import {Ban,ShieldCheck} from "lucide-react";
import {updateMarketplaceUserBlock} from "@/app/marketplace-safety/actions";

export function MarketplaceUserBlockButton({
 targetProfileId,
 blocked,
 returnTo,
 compact=false
}:{
 targetProfileId:string;
 blocked:boolean;
 returnTo:string;
 compact?:boolean;
}){
 return <form
  action={updateMarketplaceUserBlock}
  onSubmit={event=>{
   if(!blocked&&!window.confirm("Block this user? They will no longer be able to start or continue pre-purchase messages with you."))event.preventDefault();
  }}
 >
  <input type="hidden" name="targetProfileId" value={targetProfileId}/>
  <input type="hidden" name="operation" value={blocked?"unblock":"block"}/>
  <input type="hidden" name="returnTo" value={returnTo}/>
  <button className={compact
   ?"inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-black"
   :"inline-flex items-center gap-2 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-black"
  }>
   {blocked?<ShieldCheck size={compact?14:16}/>:<Ban size={compact?14:16}/>}
   {blocked?"Unblock user":"Block user"}
  </button>
 </form>;
}
