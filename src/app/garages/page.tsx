import Link from "next/link";
import { MapPin,ShieldCheck,Wrench } from "lucide-react";
import { Header } from "@/components/header";
import { getGaragePartnersPage } from "@/lib/data/fitting";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:1;};

export default async function GaragesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const page=pageNumber(first(params.page));
 const query=(first(params.q)??"").trim().slice(0,80);
 const pageSize=24;
 const result=await getGaragePartnersPage((page-1)*pageSize,pageSize,query).catch(()=>({items:[],hasMore:false,offset:0,limit:pageSize,nearbyPostcode:null}));
 return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Buy + Fit network</p>
  <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Garages that fit recycled parts</h1>
  <p className="mt-2 max-w-2xl text-[#63706a]">Request a labour quote from an active garage partner. A garage quote does not confirm that the selected part fits your vehicle and does not include the part purchase.</p>
  <form className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row" action="/garages">
   <input name="q" defaultValue={query} className="min-h-12 flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Full postcode for nearest garages, or town / garage name"/>
   <button className="min-h-12 rounded-xl bg-[#173c31] px-5 py-3 font-black text-white">Search garages</button>
  </form>
  {result.nearbyPostcode&&<p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">Showing nearest approved Buy + Fit garages to {result.nearbyPostcode}.</p>}
  {query&&!result.nearbyPostcode&&<p className="mt-3 text-sm text-[#63706a]">Filtering garages by “{query}”. Use a full UK postcode to sort by distance.</p>}
  {result.items.length?<><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{result.items.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-6">
   <div className="flex items-center justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><Wrench size={21}/></span>{item.verifiedAt&&<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800"><ShieldCheck size={14}/>Verified garage</span>}</div>
   <h2 className="mt-5 text-xl font-black">{item.businessName}</h2>
   <p className="mt-2 flex items-center gap-2 text-sm font-bold"><MapPin size={15}/>{item.location} · {item.postcode}{item.distanceMiles!==null?" · "+item.distanceMiles.toFixed(1)+" miles away":""}</p>
   <p className="mt-3 line-clamp-4 text-sm leading-6 text-[#63706a]">{item.description}</p>
   <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#eef1eb] px-3 py-1.5">Customer-supplied parts</span><span className="rounded-full bg-[#eef1eb] px-3 py-1.5">Recycled parts</span>{item.mobileFitting&&<span className="rounded-full bg-[#eef1eb] px-3 py-1.5">Mobile fitting</span>}</div>
  </article>)}</div>{(page>1||result.hasMore)&&<nav className="mt-10 flex justify-center gap-3">{page>1&&<Link href={"/garages?"+new URLSearchParams(Object.fromEntries([["page",String(page-1)],["q",query]].filter(([,value])=>value&&value!=="1"))).toString()} className="rounded-full border border-black/15 px-5 py-3 text-sm font-black">Previous</Link>}<span className="px-3 py-3 text-sm font-bold text-[#63706a]">Page {page}</span>{result.hasMore&&<Link href={"/garages?"+new URLSearchParams(Object.fromEntries([["page",String(page+1)],["q",query]].filter(([,value])=>value))).toString()} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}</nav>}</>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 p-8 text-center"><h2 className="text-xl font-black">Garage partner recruitment is open</h2><p className="mt-2 text-sm text-[#63706a]">Approved workshops will appear here as the Buy + Fit network grows.</p></div>}
  <div className="mt-10 rounded-3xl bg-[#173c31] p-6 text-white sm:flex sm:items-center sm:justify-between"><div><h2 className="text-2xl font-black">Run a garage?</h2><p className="mt-1 text-sm text-white/70">Join without becoming a parts seller.</p></div><Link href="/garage-partner" className="mt-4 inline-block rounded-xl bg-[#d4f44d] px-5 py-3 font-black text-[#173c31] sm:mt-0">Join Buy + Fit</Link></div>
 </main></>;
}
