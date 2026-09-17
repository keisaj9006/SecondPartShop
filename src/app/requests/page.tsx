import Link from "next/link";
import { CheckCircle2,Clock3,ShieldCheck,Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { getPartRequestsPage } from "@/lib/data/part-requests";
import { conditionLabel,warrantyLabel } from "@/lib/listing-trust";
import { closePartRequest,deletePartRequest } from "./actions";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};
const pounds=(pence:number)=>"£"+(pence/100).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2});

export default async function RequestsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [user,params]=await Promise.all([requireUser("/requests"),searchParams]);
 const page=pageNumber(first(params.page));
 const pageSize=20;
 const result=await getPartRequestsPage(user.id,{offset:(page-1)*pageSize,limit:pageSize});
 const requests=result.items;
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-black tracking-[-.045em]">Part requests</h1><p className="mt-2 max-w-2xl text-[#63706a]">Requests capture parts you could not find in the current marketplace. Sellers can see privacy-safe demand leads and create listings against open requests.</p></div><Link href="/#marketplace" className="w-fit rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Find or request a part</Link></div>
  {first(params.created)==="1"&&<div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Request saved. It is now in your account.</div>}
  {requests.length?<div className="mt-8 grid gap-4">{requests.map(request=><article key={request.id} className="rounded-3xl border border-black/10 bg-white p-5">
   <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">{request.status==="open"?<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-900"><Clock3 size={13}/>Open</span>:<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-900"><CheckCircle2 size={13}/>Closed</span>}{request.categoryName&&<span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-bold">{request.categoryName}</span>}</div><h2 className="mt-3 text-xl font-black">{request.queryText}</h2>{request.oemNumber&&<p className="mt-1 text-sm text-[#63706a]">OE/OEM: <strong>{request.oemNumber}</strong></p>}{request.vehicleLabel&&<p className="mt-2 text-sm font-bold">{request.registration&&<span className="mr-1 font-mono">{request.registration} ·</span>}{request.vehicleLabel}</p>}{request.notes&&<p className="mt-3 max-w-2xl text-sm leading-6 text-[#63706a]">{request.notes}</p>}
   {request.responses.length>0&&<section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4" aria-label="Seller responses">
    <div className="flex items-center gap-2 text-sm font-black text-emerald-950"><CheckCircle2 size={16}/>{request.responses.length>1?"Compare seller responses":"Seller response"}</div>
    <p className="mt-1 text-xs leading-5 text-emerald-900">{request.responses.length>1?"Compare the delivered price and seller terms below, then open the listing to verify fitment before purchase.":"This is a live marketplace listing created for your request. Check fitment on the listing before purchase."}</p>
    <div className="mt-3 grid gap-3">{request.responses.map(response=><div key={response.id} className="rounded-2xl border border-emerald-200 bg-white p-4">
     <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-black text-[#173c31]">{response.title}</p><div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#63706a]"><span>{response.sellerName}</span>{response.sellerVerified&&<><span>·</span><span className="inline-flex items-center gap-1 font-black text-[#287154]"><ShieldCheck size={13}/>Verified seller</span></>}</div></div><Link href={"/parts/"+response.slug} className="shrink-0 rounded-full bg-[#173c31] px-4 py-2 text-center text-xs font-black text-white">View part</Link></div>
     <dl className="mt-4 grid gap-2 text-xs min-[430px]:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl bg-[#f7f9f6] p-3"><dt className="text-[#63706a]">Part price</dt><dd className="mt-1 font-black text-[#173c31]">{pounds(response.pricePence)}</dd></div>
      <div className="rounded-xl bg-[#f7f9f6] p-3"><dt className="text-[#63706a]">Delivery</dt><dd className="mt-1 font-black text-[#173c31]">{response.shippingPence>0?pounds(response.shippingPence):"Free"}</dd></div>
      <div className="rounded-xl bg-[#eef8ef] p-3"><dt className="text-[#63706a]">Delivered total</dt><dd className="mt-1 font-black text-[#173c31]">{pounds(response.totalPence)}</dd></div>
      <div className="rounded-xl bg-[#f7f9f6] p-3"><dt className="text-[#63706a]">Condition</dt><dd className="mt-1 font-bold text-[#173c31]">{conditionLabel(response.condition)}</dd></div>
      <div className="rounded-xl bg-[#f7f9f6] p-3"><dt className="text-[#63706a]">Dispatch</dt><dd className="mt-1 font-bold text-[#173c31]">{response.dispatchDays===0?"Same day":response.dispatchDays+" working day"+(response.dispatchDays===1?"":"s")}</dd></div>
      <div className="rounded-xl bg-[#f7f9f6] p-3"><dt className="text-[#63706a]">Warranty</dt><dd className="mt-1 font-bold text-[#173c31]">{warrantyLabel(response.warrantyDays)}</dd></div>
     </dl>
    </div>)}</div>
   </section>}
   {request.status==="open"&&<div className={"mt-4 rounded-xl p-3 text-sm "+(request.matchingSellerCount>0?"bg-cyan-50 text-cyan-950":"bg-[#f4f7f2] text-[#56625d]")}>{request.matchingSellerCount>0?<><strong>{request.matchingSellerCount} matching seller{request.matchingSellerCount===1?"":"s"} found</strong>{request.verifiedSellerCount>0&&<span> · {request.verifiedSellerCount} verified</span>}<p className="mt-1 text-xs leading-5">SecondPart routes this request to sellers whose inventory, donor vehicles or fitment evidence are relevant.</p></>:<><strong>Still matching your request</strong><p className="mt-1 text-xs leading-5">No relevant seller is matched yet. The request stays active and can match later as seller inventory changes.</p></>}</div>}<p className="mt-3 text-xs text-[#8a918e]">Created {new Date(request.createdAt).toLocaleDateString("en-GB")}</p></div><div className="flex gap-2">{request.status==="open"&&<form action={closePartRequest}><input type="hidden" name="id" value={request.id}/><button className="rounded-xl border border-black/10 px-3 py-2 text-xs font-black">Mark closed</button></form>}<form action={deletePartRequest}><input type="hidden" name="id" value={request.id}/><button aria-label="Delete request" className="rounded-xl border border-red-200 p-2 text-red-700"><Trash2 size={16}/></button></form></div></div>
  </article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><h2 className="text-xl font-black">No part requests yet</h2><p className="mx-auto mt-2 max-w-lg text-[#63706a]">When a compatible part is missing, you can save exactly what you need instead of starting the search again later.</p></div>}
 {(page>1||result.hasMore)&&<nav aria-label="Part request pages" className="mt-8 flex items-center justify-center gap-3">{page>1&&<Link href={page===2?"/requests":"/requests?page="+(page-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {page}</span>{result.hasMore&&<Link href={"/requests?page="+(page+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}</nav>}
 </main></>;
}
