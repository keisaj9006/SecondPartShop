import Link from "next/link";
import { AlertTriangle,CheckCircle2 } from "lucide-react";
import { Header } from "@/components/header";
import { TransactionCaseForm } from "@/components/transaction-case-form";
import { ReturnShipmentForm } from "@/components/return-shipment-form";
import { requireUser } from "@/lib/auth";
import { getBuyerOrders } from "@/lib/data/orders";
import { getTransactionCases } from "@/lib/data/transaction-cases";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default async function BuyerCasesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const user=await requireUser("/account/cases");
 const [cases,orders]=await Promise.all([getTransactionCases().catch(()=>[]),getBuyerOrders(user.id).catch(()=>[])]);
 const buyerCases=cases.filter(item=>item.buyerId===user.id);
 const existingItems=new Set(buyerCases.filter(item=>["open","seller_response","under_review"].includes(item.status)).map(item=>item.orderItemId));
 const eligible=orders.flatMap(order=>order.items.filter(item=>
  ["paid","disputed"].includes(order.paymentStatus)&&
  !["cancelled","refunded","returned"].includes(item.fulfilmentStatus)&&
  !existingItems.has(item.id)
 ));
 const selectedId=first(params.item);
 const selected=eligible.find(item=>item.id===selectedId)??null;

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Buyer protection</p>
  <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Returns & transaction cases</h1>
  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Use a case when a completed marketplace purchase has a return, condition, delivery or transaction problem. Opening a case blocks any seller transfer that has not already been released.</p>

  {selected&&<TransactionCaseForm orderItemId={selected.id} partTitle={selected.partTitle}/>}

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
    {item.resolution&&<div className="mt-4 flex items-center gap-2 text-sm font-black text-emerald-800"><CheckCircle2 size={17}/>{item.resolution==="full_refund"?"Full refund issued":"Case resolved without refund"}</div>}
   </article>)}</div>:<div className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-sm text-[#63706a]"><AlertTriangle className="mb-3"/>You do not have any transaction cases.</div>}
  </section>
 </main></>;
}
