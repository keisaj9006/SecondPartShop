import Link from "next/link";
import { Bookmark,Search,Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { getSavedSearches } from "@/lib/data/buyer-account";
import { deleteSavedSearch } from "./actions";

export const dynamic="force-dynamic";

const summary=(params:Record<string,string>)=>[
 params.q?"Search: "+params.q:null,
 params.pc?"Near "+params.pc:null,
 params.collection==="1"?"Collection only":null,
 params.min?"Min £"+params.min:null,
 params.max?"Max £"+params.max:null
].filter(Boolean) as string[];

export default async function SavedSearchesPage(){
 const user=await requireUser("/saved-searches");
 const searches=await getSavedSearches(user.id);
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-black tracking-[-.045em]">Saved searches</h1><p className="mt-2 max-w-2xl text-[#63706a]">Jump back into the same vehicle, part and filter combination without rebuilding your search.</p></div><Link href="/#marketplace" className="w-fit rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">New search</Link></div>
  {searches.length?<div className="mt-8 grid gap-4">{searches.map(item=>{
   const params=new URLSearchParams(item.params);
   const href="/?"+params.toString()+"#marketplace";
   const chips=summary(item.params);
   return <article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
     <div><div className="flex items-center gap-2 text-[#287154]"><Bookmark size={17}/><span className="text-xs font-black uppercase tracking-[.12em]">Saved search</span></div><h2 className="mt-2 text-xl font-black">{item.name}</h2><div className="mt-3 flex flex-wrap gap-2">{chips.length?chips.map(chip=><span key={chip} className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-bold">{chip}</span>):<span className="text-sm text-[#63706a]">Vehicle/category filters saved</span>}</div><p className="mt-3 text-xs text-[#8a918e]">Saved {new Date(item.createdAt).toLocaleDateString("en-GB")}</p></div>
     <div className="flex gap-2"><Link href={href} className="inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white"><Search size={15}/>Run search</Link><form action={deleteSavedSearch}><input type="hidden" name="id" value={item.id}/><button aria-label="Delete saved search" className="rounded-xl border border-red-200 p-2.5 text-red-700"><Trash2 size={16}/></button></form></div>
    </div>
   </article>;
  })}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><Bookmark className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No saved searches yet</h2><p className="mx-auto mt-2 max-w-lg text-[#63706a]">Apply a vehicle, part, category or filter on the marketplace, then save that search.</p></div>}
 </main></>;
}