import Link from "next/link";
import { ArrowUpRight,Search } from "lucide-react";
import { Header } from "@/components/header";
import { requireSeller } from "@/lib/auth";
import { getSellerPartRequestLeads } from "@/lib/data/seller-request-leads";

export const dynamic="force-dynamic";

export default async function SellerRequestsPage(){
 await requireSeller("/dashboard/requests");
 const leads=await getSellerPartRequestLeads();
 return <><Header/><main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Buyer demand</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Open part requests</h1><p className="mt-2 max-w-2xl text-[#63706a]">See what buyers are actively looking for. Buyer identity and registration are not shared here.</p></div>
   <Link href="/dashboard" className="w-fit rounded-full border border-black/15 px-5 py-3 text-sm font-black">Back to dashboard</Link>
  </div>
  {leads.length?<div className="mt-8 grid gap-4">{leads.map(lead=>{
   const vehicle=[lead.vehicleMake&&lead.vehicleModel?lead.vehicleMake+" "+lead.vehicleModel:null,lead.year?String(lead.year):null,lead.vehicleVariant,lead.engineSizeSimple?lead.engineSizeSimple+"cc":null,lead.fuelType].filter(Boolean).join(" · ");
   const params=new URLSearchParams({request:lead.id});
   return <article key={lead.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
     <div className="min-w-0">
      <div className="flex flex-wrap gap-2">{lead.categoryName&&<span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{lead.categoryName}</span>}<span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-900">Open request</span></div>
      <h2 className="mt-3 text-xl font-black">{lead.queryText}</h2>
      {lead.oemNumber&&<p className="mt-2 text-sm text-[#63706a]">OE/OEM: <strong className="font-mono text-[#173c31]">{lead.oemNumber}</strong></p>}
      {vehicle&&<p className="mt-2 text-sm font-bold">{vehicle}</p>}
      {lead.notes&&<p className="mt-3 max-w-3xl text-sm leading-6 text-[#63706a]">{lead.notes}</p>}
      <p className="mt-3 text-xs text-[#8a918e]">Requested {new Date(lead.createdAt).toLocaleDateString("en-GB")}</p>
     </div>
     <Link href={"/dashboard/listings/new?"+params.toString()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173c31] px-4 py-3 text-sm font-black text-white">Create matching listing<ArrowUpRight size={16}/></Link>
    </div>
   </article>;
  })}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><Search className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No open buyer requests</h2><p className="mx-auto mt-2 max-w-xl text-[#63706a]">New requests will appear here when buyers cannot find the exact part they need.</p></div>}
 </main></>;
}
