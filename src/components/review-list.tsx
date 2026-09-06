import Link from "next/link";
import { Star } from "lucide-react";
import type { TransactionReview } from "@/lib/types";

const stars=(rating:number)=>Array.from({length:5},(_,index)=><Star key={index} size={15} className={index<rating?"fill-current text-amber-500":"text-black/15"}/>);

export function ReviewList({reviews}:{reviews:TransactionReview[]}){
  if(!reviews.length)return <div className="rounded-3xl border border-dashed border-black/15 bg-white p-7 text-sm text-[#63706a]">No published transaction reviews yet.</div>;
  return <div className="grid gap-4">
    {reviews.map(review=><article key={review.id} className="rounded-3xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/member/${review.reviewerHandle}`} className="font-black hover:underline">{review.reviewerDisplayName}</Link>
          <p className="mt-0.5 text-xs text-[#63706a]">@{review.reviewerHandle} · Verified transaction</p>
        </div>
        <div className="flex items-center gap-0.5" aria-label={`${review.overallRating} out of 5 stars`}>{stars(review.overallRating)}</div>
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#287154]">{review.direction==="buyer_to_seller"?"Buyer review of seller":"Seller review of buyer"}</p>
      <p className="mt-1 text-sm font-black">{review.partTitle}</p>
      {review.comment&&<p className="mt-3 text-sm leading-6 text-[#56625d]">{review.comment}</p>}
      <p className="mt-3 text-xs text-[#7a847f]">{new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(new Date(review.createdAt))}</p>
    </article>)}
  </div>;
}
