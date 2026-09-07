import Link from "next/link";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { getBuyerFittingRequests } from "@/lib/data/fitting";
import { respondToFittingQuote } from "./actions";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const money=(pence:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);

export default async function BuyerFittingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const user=await requireUser("/account/fitting");
 const items=await getBuyerFittingRequests(user.id).catch(()=>[]);
 const error=first(params.error);
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Buy + Fit</p><h1 className="mt-2 text-4xl font-black">Fitting requests</h1>
  <p className="mt-2 text-[#63706a]">Labour quotes are separate from the marketplace part payment. Accepting a quote does not charge you automatically.</p>
  {first(params.created)==="1"&&<div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Fitting quote requested. The garage has been notified.</div>}
  {error&&<div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{error==="duplicate"?"You already have an open request for that garage, part and vehicle.":error==="limit"?"You have reached the active fitting-request limit.":"The fitting request could not be created."}</div>}
  {items.length?<div className="mt-7 grid gap-4">{items.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black capitalize">{item.status.replaceAll("_"," ")}</span><h2 className="mt-3 text-xl font-black"><Link href={"/parts/"+item.partSlug} className="hover:underline">{item.partTitle}</Link></h2><p className="mt-1 text-sm text-[#63706a]">Garage: {item.garageName} · {item.garageLocation}</p><p className="mt-1 text-sm font-bold">{item.vehicleRegistration?item.vehicleRegistration+" · ":""}{item.vehicleMake} {item.vehicleModel} · {item.vehicleYear}{item.vehicleEngineSize?" · "+item.vehicleEngineSize+"cc":""}{item.vehicleFuel?" · "+item.vehicleFuel:""}</p></div>{item.quotePence!==null&&<p className="text-2xl font-black">{money(item.quotePence)}<span className="block text-xs font-bold text-[#63706a]">labour quote</span></p>}</div>
   {item.buyerNotes&&<p className="mt-4 rounded-xl bg-[#f8f7f2] p-3 text-sm"><strong>Your note:</strong> {item.buyerNotes}</p>}
   {item.quoteNote&&<p className="mt-3 rounded-xl bg-[#f4f7f2] p-3 text-sm"><strong>Garage note:</strong> {item.quoteNote}</p>}
   {item.status==="quoted"&&<div className="mt-4 flex flex-wrap gap-2"><form action={respondToFittingQuote}><input type="hidden" name="requestId" value={item.id}/><button name="action" value="accept" className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Accept quote</button></form><form action={respondToFittingQuote}><input type="hidden" name="requestId" value={item.id}/><button name="action" value="cancel" className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">Cancel request</button></form></div>}
   {["requested","accepted"].includes(item.status)&&<form action={respondToFittingQuote} className="mt-4"><input type="hidden" name="requestId" value={item.id}/><button name="action" value="cancel" className="text-sm font-black text-red-800 underline">Cancel request</button></form>}
   {item.status==="accepted"&&<div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-950">Quote accepted. No labour payment was taken by SecondPart. Appointment/contact handoff is the next Buy + Fit release step.</div>}
  </article>)}</div>:<div className="mt-7 rounded-3xl border border-dashed border-black/20 p-8 text-center"><h2 className="text-xl font-black">No fitting requests yet</h2><p className="mt-2 text-sm text-[#63706a]">Select a vehicle, open a compatible part and choose Buy + Fit to request labour quotes.</p><Link href="/#marketplace" className="mt-5 inline-block rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Browse parts</Link></div>}
 </main></>;
}
