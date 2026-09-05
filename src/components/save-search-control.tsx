"use client";

import { useActionState,useMemo,useState } from "react";
import Link from "next/link";
import { BookmarkPlus,Check } from "lucide-react";
import { createSavedSearch } from "@/app/saved-searches/actions";
import type { ActionState,MarketplaceFilters } from "@/lib/types";

const initial:ActionState={status:"idle"};

const filtersToParams=(filters:MarketplaceFilters)=>{
 const params:Record<string,string>={};
 if(filters.query)params.q=filters.query;
 if(filters.category)params.category=filters.category;
 if(filters.condition)params.condition=filters.condition;
 if(filters.sort&&filters.sort!=="best")params.sort=filters.sort;
 if(Number.isFinite(filters.minPrice))params.min=String(filters.minPrice);
 if(Number.isFinite(filters.maxPrice))params.max=String(filters.maxPrice);
 if(filters.postcode)params.pc=filters.postcode;
 if(filters.collectionOnly)params.collection="1";
 if(filters.vehicle)params.vehicle=filters.vehicle;
 if(filters.vehicleRegistration)params.vr=filters.vehicleRegistration;
 if(filters.catalogueVariant)params.cv=filters.catalogueVariant;
 if(filters.catalogueYear!==undefined)params.cy=String(filters.catalogueYear);
 if(filters.catalogueFuel)params.cf=filters.catalogueFuel;
 if(filters.catalogueEngineSize!==undefined)params.ce=String(filters.catalogueEngineSize);
 return params;
};

export function SaveSearchControl({signedIn,filters}:{signedIn:boolean;filters:MarketplaceFilters}){
 const [state,action,pending]=useActionState(createSavedSearch,initial);
 const [open,setOpen]=useState(false);
 const params=useMemo(()=>filtersToParams(filters),[filters]);
 const hasContext=Object.keys(params).length>0;
 const defaultName=filters.query?.trim()||"My parts search";

 if(!hasContext)return null;
 if(!signedIn)return <Link href="/account?returnTo=%2F%23marketplace" className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-black"><BookmarkPlus size={15}/>Sign in to save search</Link>;
 if(!open&&state.status!=="success")return <button type="button" onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-black hover:bg-[#f8f7f2]"><BookmarkPlus size={15}/>Save search</button>;
 if(state.status==="success")return <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800"><Check size={15}/>Search saved</span>;

 return <form action={action} className="flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-black/10 bg-white p-3 sm:flex-row sm:items-center">
  <input type="hidden" name="searchParams" value={JSON.stringify(params)}/>
  <input name="name" required minLength={2} maxLength={80} defaultValue={defaultName} className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#173c31]" aria-label="Saved search name"/>
  <button disabled={pending} className="rounded-xl bg-[#173c31] px-4 py-2 text-sm font-black text-white disabled:opacity-50">{pending?"Saving…":"Save"}</button>
  <button type="button" onClick={()=>setOpen(false)} className="rounded-xl border border-black/10 px-3 py-2 text-sm font-bold">Cancel</button>
  {state.status==="error"&&<p role="status" className="text-xs font-bold text-red-700 sm:basis-full">{state.message}</p>}
 </form>;
}