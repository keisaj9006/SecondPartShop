import Link from "next/link";
import { Scale } from "lucide-react";
import { AdminCaseResolution } from "@/components/admin-case-resolution";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { getTransactionCases } from "@/lib/data/transaction-cases";

export const dynamic="force-dynamic";
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default async function CommerceAdminPage(){
 await requireAdmin("/admin/commerce");
 const cases=await getTransactionCases().catch(()=>[]);

 return <><Header/><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Marketplace operations</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Commerce cases</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Review buyer returns and disputes. Full refund runs the controlled Stripe reversal/refund path; rejecting the case re-opens an eligible blocked payout.</p></div><Link href="/admin/moderation" className="w-fit rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Moderation</Link></div>

  {cases.length?<div className="mt-8 grid gap-5">{cases.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#287154]">{label(item.caseType)}</p><Link href={"/parts/"+item.partSlug} className="mt-1 block text-xl font-black hover:underline">{item.partTitle}</Link><p className="mt-1 text-sm text-[#63706a]">Seller: {item.sellerName} · Case {item.id.slice(0,8).toUpperCase()}</p></div><span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black">{label(item.status)}</span></div>
   <div className="mt-4 rounded-2xl bg-[#f8f7f2] p-4"><p className="font-black">{item.reason}</p><p className="mt-2 text-sm leading-6 text-[#56625d]">{item.details}</p></div>
   {item.sellerResponse&&<div className="mt-3 rounded-2xl border border-black/10 p-4"><p className="text-xs font-black uppercase tracking-wide text-[#287154]">Seller response</p><p className="mt-2 text-sm leading-6">{item.sellerResponse}</p></div>}
   {["open","seller_response","under_review"].includes(item.status)?<AdminCaseResolution caseId={item.id}/>:<div className="mt-4 rounded-xl bg-[#eef1eb] p-3 text-sm font-black">Resolved: {item.resolution?label(item.resolution):label(item.status)}{item.resolutionNotes?" · "+item.resolutionNotes:""}</div>}
  </article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/15 bg-white p-12 text-center"><Scale className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No commerce cases</h2><p className="mt-2 text-sm text-[#63706a]">Open buyer cases will appear here for review.</p></div>}
 </main></>;
}
