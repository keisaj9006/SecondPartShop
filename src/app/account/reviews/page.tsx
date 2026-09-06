import Link from "next/link";
import { CheckCircle2,Clock3,ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { TransactionReviewForm } from "@/components/transaction-review-form";
import { VerifiedFitFeedbackForm } from "@/components/verified-fit-feedback-form";
import { requireUser } from "@/lib/auth";
import { getReviewOpportunitiesPage } from "@/lib/data/reviews";
import { getFitFeedbackOpportunitiesPage } from "@/lib/data/fit-feedback";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export default async function ReviewsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [,params]=await Promise.all([requireUser("/account/reviews"),searchParams]);
 const reviewPage=pageNumber(first(params.reviewPage));
 const fitPage=pageNumber(first(params.fitPage));
 const pageSize=20;
 const [reviewResult,fitResult]=await Promise.all([
  getReviewOpportunitiesPage({offset:(reviewPage-1)*pageSize,limit:pageSize}).catch(()=>({items:[],hasMore:false,offset:0,limit:pageSize})),
  getFitFeedbackOpportunitiesPage({offset:(fitPage-1)*pageSize,limit:pageSize}).catch(()=>({items:[],hasMore:false,offset:0,limit:pageSize}))
 ]);
 const opportunities=reviewResult.items;
 const fitOpportunities=fitResult.items;
 const href=(nextReview=reviewPage,nextFit=fitPage)=>{const search=new URLSearchParams();if(nextReview>1)search.set("reviewPage",String(nextReview));if(nextFit>1)search.set("fitPage",String(nextFit));const qs=search.toString();return qs?"/account/reviews?"+qs:"/account/reviews";};
 const pending=opportunities.filter(item=>!item.existingReviewId);
 const submitted=opportunities.filter(item=>Boolean(item.existingReviewId));
 const fitPending=fitOpportunities.filter(item=>!item.existingResult||item.existingResult==="not_installed");
 const fitSubmitted=fitOpportunities.filter(item=>item.existingResult&&item.existingResult!=="not_installed");

 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Trust & reputation</p>
  <h1 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-4xl">Reviews & fitment</h1>
  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Transaction reviews build member reputation. Verified fitment feedback separately improves vehicle compatibility data using completed purchases linked to the checkout vehicle.</p>

  {(fitOpportunities.length>0||fitPage>1)&&<section className="mt-8">
   <div className="flex items-center gap-2"><ShieldCheck size={20} className="text-cyan-800"/><h2 className="text-2xl font-black">Verified fitment feedback</h2></div>
   <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Tell SecondPart whether a purchased part actually fitted the vehicle selected at checkout. These answers become transaction-backed compatibility evidence, not anonymous votes.</p>
   {fitPending.length>0&&<div className="mt-5 grid gap-5">{fitPending.map(item=><article key={item.orderItemId} className="rounded-3xl border border-cyan-200 bg-white p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-wide text-cyan-900">You bought this part</p><Link href={"/parts/"+item.partSlug} className="mt-1 block text-xl font-black hover:underline">{item.partTitle}</Link><VerifiedFitFeedbackForm opportunity={item}/></article>)}</div>}
   {fitOpportunities.length===0&&fitPage>1&&<div className="mt-5 rounded-2xl border border-dashed border-black/15 bg-white p-6 text-sm text-[#63706a]">No fitment entries on this page.</div>}
   {fitSubmitted.length>0&&<details className="mt-5 rounded-2xl border border-black/10 bg-white p-4"><summary className="cursor-pointer text-sm font-black">{fitSubmitted.length} submitted fitment confirmation{fitSubmitted.length===1?"":"s"}</summary><div className="mt-4 grid gap-4">{fitSubmitted.map(item=><div key={item.orderItemId} className="rounded-2xl bg-[#f8f7f2] p-4"><p className="font-black">{item.partTitle}</p><VerifiedFitFeedbackForm opportunity={item}/></div>)}</div></details>}
  {(fitPage>1||fitResult.hasMore)&&<nav aria-label="Fitment feedback pages" className="mt-5 flex items-center justify-center gap-3">{fitPage>1&&<Link href={href(reviewPage,fitPage-1)} className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-black">Previous fitment</Link>}<span className="text-xs font-bold text-[#63706a]">Fitment page {fitPage}</span>{fitResult.hasMore&&<Link href={href(reviewPage,fitPage+1)} className="rounded-full bg-[#173c31] px-4 py-2 text-xs font-black text-white">Next fitment</Link>}</nav>}
  </section>}

  <section className="mt-10">
   <div className="flex items-center gap-2"><Clock3 size={20} className="text-[#287154]"/><h2 className="text-2xl font-black">Waiting for your review</h2></div>
   {pending.length?<div className="mt-5 grid gap-5">{pending.map(item=><article key={item.orderItemId} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
    <p className="text-xs font-black uppercase tracking-wide text-[#287154]">{item.direction==="buyer_to_seller"?"You bought this item":"You sold this item"}</p>
    <h3 className="mt-1 text-xl font-black">{item.partTitle}</h3>
    <p className="mt-1 text-sm text-[#63706a]">Reviewing <Link href={`/member/${item.counterpartHandle}`} className="font-black text-[#173c31] hover:underline">{item.counterpartDisplayName} · @{item.counterpartHandle}</Link></p>
    <TransactionReviewForm opportunity={item}/>
   </article>)}</div>:<div className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-7 text-sm text-[#63706a]">No completed transactions are waiting for your review.</div>}
  {(reviewPage>1||reviewResult.hasMore)&&<nav aria-label="Review opportunity pages" className="mt-5 flex items-center justify-center gap-3">{reviewPage>1&&<Link href={href(reviewPage-1,fitPage)} className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-black">Previous reviews</Link>}<span className="text-xs font-bold text-[#63706a]">Review page {reviewPage}</span>{reviewResult.hasMore&&<Link href={href(reviewPage+1,fitPage)} className="rounded-full bg-[#173c31] px-4 py-2 text-xs font-black text-white">Next reviews</Link>}</nav>}
  </section>

  {submitted.length>0&&<section className="mt-10">
   <div className="flex items-center gap-2"><CheckCircle2 size={20} className="text-emerald-700"/><h2 className="text-2xl font-black">Submitted</h2></div>
   <div className="mt-4 grid gap-3">{submitted.map(item=><div key={item.orderItemId} className="rounded-2xl border border-black/10 bg-white p-4"><p className="font-black">{item.partTitle}</p><p className="mt-1 text-sm text-[#63706a]">Your review of @{item.counterpartHandle} has been submitted.</p></div>)}</div>
  </section>}
 </main></>;
}
