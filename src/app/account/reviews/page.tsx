import Link from "next/link";
import { CheckCircle2,Clock3 } from "lucide-react";
import { Header } from "@/components/header";
import { TransactionReviewForm } from "@/components/transaction-review-form";
import { requireUser } from "@/lib/auth";
import { getReviewOpportunities } from "@/lib/data/reviews";

export const dynamic="force-dynamic";

export default async function ReviewsPage(){
 await requireUser("/account/reviews");
 const opportunities=await getReviewOpportunities().catch(()=>[]);
 const pending=opportunities.filter(item=>!item.existingReviewId);
 const submitted=opportunities.filter(item=>Boolean(item.existingReviewId));

 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Trust & reputation</p>
  <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Transaction reviews</h1>
  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">A review can only be submitted after SecondPart has released the transaction funds. This prevents reviews from people who never completed a real purchase or sale.</p>

  <section className="mt-8">
   <div className="flex items-center gap-2"><Clock3 size={20} className="text-[#287154]"/><h2 className="text-2xl font-black">Waiting for your review</h2></div>
   {pending.length?<div className="mt-5 grid gap-5">{pending.map(item=><article key={item.orderItemId} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
    <p className="text-xs font-black uppercase tracking-wide text-[#287154]">{item.direction==="buyer_to_seller"?"You bought this item":"You sold this item"}</p>
    <h3 className="mt-1 text-xl font-black">{item.partTitle}</h3>
    <p className="mt-1 text-sm text-[#63706a]">Reviewing <Link href={`/member/${item.counterpartHandle}`} className="font-black text-[#173c31] hover:underline">{item.counterpartDisplayName} · @{item.counterpartHandle}</Link></p>
    <TransactionReviewForm opportunity={item}/>
   </article>)}</div>:<div className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-7 text-sm text-[#63706a]">No completed transactions are waiting for your review.</div>}
  </section>

  {submitted.length>0&&<section className="mt-10">
   <div className="flex items-center gap-2"><CheckCircle2 size={20} className="text-emerald-700"/><h2 className="text-2xl font-black">Submitted</h2></div>
   <div className="mt-4 grid gap-3">{submitted.map(item=><div key={item.orderItemId} className="rounded-2xl border border-black/10 bg-white p-4"><p className="font-black">{item.partTitle}</p><p className="mt-1 text-sm text-[#63706a]">Your review of @{item.counterpartHandle} has been submitted.</p></div>)}</div>
  </section>}
 </main></>;
}
