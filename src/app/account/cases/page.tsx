import Link from "next/link";
import { AlertTriangle,CheckCircle2 } from "lucide-react";
import { CaseEvidencePanel } from "@/components/case-evidence-panel";
import { Header } from "@/components/header";
import { TransactionCaseForm } from "@/components/transaction-case-form";
import { ReturnShipmentForm } from "@/components/return-shipment-form";
import { requireUser } from "@/lib/auth";
import { getTransactionCaseEvidence } from "@/lib/data/case-evidence";
import { getBuyerOrdersPage } from "@/lib/data/orders";
import { getActiveCaseOrderItemIds,getBuyerCaseOrderItem,getBuyerTransactionCasesPage } from "@/lib/data/transaction-cases";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default async function BuyerCasesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const user=await requireUser("/account/cases");
 const casePage=pageNumber(first(params.casePage));
 const casePageSize=20;
 const selectedId=first(params.item);
 const [caseResult,orderResult,selectedPurchase]=await Promise.all([
  getBuyerTransactionCasesPage(user.id,{offset:(casePage-1)*casePageSize,limit:casePageSize}).catch(()=>({items:[],hasMore:false,offset:(casePage-1)*casePageSize,limit:casePageSize})),
  getBuyerOrdersPage(user.id,{limit:30}).catch(()=>({items:[],hasMore:false,offset:0,limit:30})),
  selectedId?getBuyerCaseOrderItem(user.id,selectedId).catch(()=>null):Promise.resolve(null)
 ]);
 const buyerCases=caseResult.items;
 const evidenceByCase=await getTransactionCaseEvidence(buyerCases.map(item=>item.id)).catch(()=>new Map());
 let eligible=orderResult.items.flatMap(order=>order.items.filter(item=>
  ["paid","disputed"].includes(order.paymentStatus)&&
  !["cancelled","refunded","returned"].includes(item.fulfilmentStatus)
 ).map(item=>({id:item.id,partTitle:item.partTitle,sellerName:item.sellerName})));
 if(selectedPurchase&&!eligible.some(item=>item.id===selectedPurchase.id))eligible=[selectedPurchase,...eligible];
 const existingItems=await getActiveCaseOrderItemIds(eligible.map(item=>item.id)).catch(()=>new Set<string>());
 eligible=eligible.filter(item=>!existingItems.has(item.id));
 const requestedType=first(params.type);
 const defaultCaseType=(["return","dispute","cancellation"] as string[]).includes(requestedType??"")?requestedType as "return"|"dispute"|"cancellation":"return";
 const selected=eligible.find(item=>item.id===selectedId)??null;

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Buyer protection</p>
  <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Returns & transaction cases</h1>
  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Use a case when a completed marketplace purchase has a return, condition, delivery or transaction problem. Opening a case blocks any seller transfer that has not already been released.</p>

  {selected&&<TransactionCaseForm orderItemId={selected.id} partTitle={selected.partTitle} defaultCaseType={defaultCaseType}/>}

  {!selected&&eligible.length>0&&<section className="mt-8 rounded-3xl border border-black/10 bg-white p-5">
   <h2 className="text-xl font-black">Choose a purchase</h2>
   <div className="mt-4 grid gap-2">{eligible.map(item=><Link key={item.id} href={"/account/cases?item="+encodeURIComponent(item.id)} className="rounded-xl bg-[#f8f7f2] p-4 text-sm font-black hover:bg-[#eef1eb]">{item.partTitle} · {item.sellerName}</Link>)}</div>
  </section>}

  <section className="mt-10">
   <h2 className="text-2xl font-black">Your cases</h2>
   {buyerCases.length?<div className="mt-5 grid gap-4">{buyerCases.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#287154]">{label(item.caseType)}</p><Link href={"/parts/"+item.partSlug} className="mt-1 block text-lg font-black hover:underline">{item.partTitle}</Link><p className="mt-1 text-sm text-[#63706a]">Seller: {item.sellerName}</p></div><span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black">{label(item.status)}</span></div>
    <p className="mt-4 text-sm font-black">{item.reason}</p><p className="mt-1 text-sm leading-6 text-[#63706a]">{item.details}</p>
    {item.sellerResponse&&<div className="mt-4 rounded-2xl bg-[#f8f7f2] p-4"><p className="text-xs font-black uppercase tracking-wide text-[#287154]">Seller response</p><p className="mt-2 text-sm leading-6">{item.sellerResponse}</p></div>}{item.status==="return_authorized"&&<ReturnShipmentForm caseId={item.id}/>} {item.returnTrackingNumber&&<div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900"><p className="font-black">Return shipment recorded</p><p className="mt-1">{item.returnTrackingCarrier?item.returnTrackingCarrier+" · ":""}{item.returnTrackingNumber}</p></div>}{item.providerDisputeId&&<div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900"><p className="font-black">Card-provider dispute</p><p className="mt-1">Status: {item.providerDisputeStatus??"under review"}</p></div>}
    <CaseEvidencePanel caseId={item.id} evidence={evidenceByCase.get(item.id)??[]} canUpload={!["resolved","rejected","cancelled"].includes(item.status)}/>{item.resolution&&<div className="mt-4 flex items-center gap-2 text-sm font-black text-emerald-800"><CheckCircle2 size={17}/>{item.resolution==="full_refund"?"Full refund issued":"Case resolved without refund"}</div>}
   </article>)}</div>:<div className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-sm text-[#63706a]"><AlertTriangle className="mb-3"/>You do not have any transaction cases.</div>}
  </section>
  {(casePage>1||caseResult.hasMore)&&<nav aria-label="Transaction case pages" className="mt-8 flex items-center justify-center gap-3">{casePage>1&&<Link href={casePage===2?"/account/cases":"/account/cases?casePage="+(casePage-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {casePage}</span>{caseResult.hasMore&&<Link href={"/account/cases?casePage="+(casePage+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}</nav>}
 </main></>;
}
