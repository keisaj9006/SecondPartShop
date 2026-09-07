import Link from "next/link";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { getGarageFittingRequests,getGaragePartnerForOwner } from "@/lib/data/fitting";
import { respondToFittingRequest } from "./actions";

export const dynamic="force-dynamic";
const money=(pence:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);

export default async function GarageRequestsPage(){
 const user=await requireUser("/garage-partner/requests");
 const partner=await getGaragePartnerForOwner(user.id);
 if(!partner)return <><Header/><main className="mx-auto max-w-3xl px-4 py-14"><h1 className="text-3xl font-black">Garage partner profile required</h1><Link href="/garage-partner" className="mt-5 inline-block underline">Apply to Buy + Fit</Link></main></>;
 const items=partner.status==="active"?await getGarageFittingRequests(partner.id).catch(()=>[]):[];
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <Link href="/garage-partner" className="text-sm font-black underline">Garage profile</Link><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#287154]">Garage partner</p><h1 className="mt-2 text-4xl font-black">Fitting quote requests</h1>
  {partner.status!=="active"?<div className="mt-6 rounded-2xl bg-amber-50 p-4 font-bold text-amber-900">Your garage must be active before it can receive fitting requests.</div>:items.length?<div className="mt-7 grid gap-4">{items.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black capitalize">{item.status}</span><h2 className="mt-3 text-xl font-black"><Link href={"/parts/"+item.partSlug} className="hover:underline">{item.partTitle}</Link></h2><p className="mt-1 text-sm font-bold">{item.vehicleRegistration?item.vehicleRegistration+" · ":""}{item.vehicleMake} {item.vehicleModel} {item.vehicleYear}{item.vehicleEngineSize?" · "+item.vehicleEngineSize+"cc":""}{item.vehicleFuel?" · "+item.vehicleFuel:""}</p></div>{item.quotePence!==null&&<p className="text-xl font-black">{money(item.quotePence)}</p>}</div>
   {item.buyerNotes&&<p className="mt-4 rounded-xl bg-[#f8f7f2] p-3 text-sm"><strong>Buyer note:</strong> {item.buyerNotes}</p>}
   {["requested","quoted"].includes(item.status)&&<form action={respondToFittingRequest} className="mt-4 grid gap-3 rounded-2xl bg-[#f4f7f2] p-4 sm:grid-cols-[150px_1fr_auto] sm:items-end"><input type="hidden" name="requestId" value={item.id}/><label className="text-xs font-black">Labour quote £<input required min="0" max="20000" step="0.01" name="quote" defaultValue={item.quotePence!==null?item.quotePence/100:undefined} className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2"/></label><label className="text-xs font-black">Quote / booking note<input name="note" maxLength={1000} defaultValue={item.quoteNote??""} className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2" placeholder="What is included, estimated time, booking instructions"/></label><div className="flex gap-2"><button name="action" value="quote" className="rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white">Send quote</button><button name="action" value="decline" formNoValidate className="rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-black">Decline</button></div></form>}
   {item.status==="accepted"&&<div className="mt-4 flex flex-wrap gap-2"><Link href={"/fitting/"+item.id} className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Arrange fitting</Link><form action={respondToFittingRequest}><input type="hidden" name="requestId" value={item.id}/><button name="action" value="complete" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">Mark fitting complete</button></form></div>}{item.status==="completed"&&<Link href={"/fitting/"+item.id} className="mt-4 inline-block text-sm font-black underline">View fitting chat history</Link>}
  </article>)}</div>:<div className="mt-7 rounded-3xl border border-dashed border-black/20 p-8 text-center"><h2 className="text-xl font-black">No fitting requests yet</h2><p className="mt-2 text-sm text-[#63706a]">Buyer requests will appear here when they select your garage for a labour quote.</p></div>}
 </main></>;
}
