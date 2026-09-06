import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { CaseEvidencePanel } from "@/components/case-evidence-panel";
import { Header } from "@/components/header";
import { SellerCaseResponseForm } from "@/components/seller-case-response-form";
import { ReturnReceivedForm } from "@/components/return-received-form";
import { requireSeller } from "@/lib/auth";
import { getTransactionCaseEvidence } from "@/lib/data/case-evidence";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { getTransactionCases } from "@/lib/data/transaction-cases";

export const dynamic="force-dynamic";
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default async function SellerCasesPage(){
 const {user}=await requireSeller("/dashboard/cases");
 const seller=await getSellerForOwner(user.id);
 const allCases=await getTransactionCases().catch(()=>[]);
 const cases=seller?allCases.filter(item=>item.sellerSlug===seller.slug):[];
 const evidenceByCase=await getTransactionCaseEvidence(cases.map(item=>item.id)).catch(()=>new Map());

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Seller dashboard</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Returns & cases</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Respond with factual listing, condition, dispatch or tracking information. Payouts remain blocked while an unresolved case is active.</p></div><Link href="/dashboard/orders" className="w-fit rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Back to sales</Link></div>

  {cases.length?<div className="mt-8 grid gap-5">{cases.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#287154]">{label(item.caseType)}</p><Link href={"/parts/"+item.partSlug} className="mt-1 block text-xl font-black hover:underline">{item.partTitle}</Link></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-900">{label(item.status)}</span></div>
   <p className="mt-4 text-sm font-black">{item.reason}</p><p className="mt-1 text-sm leading-6 text-[#63706a]">{item.details}</p>
   {item.sellerResponse&&<div className="mt-4 rounded-2xl bg-[#f8f7f2] p-4"><p className="text-xs font-black uppercase tracking-wide text-[#287154]">Your latest response</p><p className="mt-2 text-sm leading-6">{item.sellerResponse}</p></div>}
   {["open","seller_response","under_review"].includes(item.status)&&<SellerCaseResponseForm caseId={item.id}/>}
   {item.returnTrackingNumber&&<div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900"><p className="font-black">Buyer return shipment</p><p className="mt-1">{item.returnTrackingCarrier?item.returnTrackingCarrier+" · ":""}{item.returnTrackingNumber}</p></div>}
   {item.caseType==="return"&&["return_authorized","return_shipped"].includes(item.status)&&<ReturnReceivedForm caseId={item.id}/>}
   {item.providerDisputeId&&<div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900"><p className="font-black">Payment-provider dispute</p><p className="mt-1">Status: {item.providerDisputeStatus??"under review"}</p></div>}
   <CaseEvidencePanel caseId={item.id} evidence={evidenceByCase.get(item.id)??[]} canUpload={!["resolved","rejected","cancelled"].includes(item.status)}/>{item.resolution&&<p className="mt-4 text-sm font-black text-[#63706a]">Resolution: {item.resolution==="full_refund"?"Full refund":"No refund"}</p>}
  </article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/15 bg-white p-10 text-center"><MessageSquareText className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No transaction cases</h2><p className="mt-2 text-sm text-[#63706a]">Buyer return requests and disputes will appear here.</p></div>}
 </main></>;
}
