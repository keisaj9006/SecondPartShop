import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck,ShoppingBag,Star,Store } from "lucide-react";
import { Header } from "@/components/header";
import { ReviewList } from "@/components/review-list";
import { getPublicMemberProfile,getPublicMemberReviews } from "@/lib/data/reputation";

export const dynamic="force-dynamic";

const rating=(value:number|null,count:number)=>value===null||count===0?"New":value.toFixed(1);

export default async function MemberPage({params}:{params:Promise<{handle:string}>}){
  const {handle}=await params;
  const profile=await getPublicMemberProfile(handle).catch(()=>null);
  if(!profile)notFound();
  const reviews=await getPublicMemberReviews(profile.id,30).catch(()=>[]);

  return <><Header/><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
    <section className="overflow-hidden rounded-[34px] bg-[#173c31] p-6 text-white sm:p-9">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#d4f44d]">SecondPart member</p>
        {profile.sellerVerified&&<span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-black"><BadgeCheck size={14}/>Verified business</span>}
        {profile.sellerType&&<span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black capitalize">{profile.sellerType} seller</span>}
      </div>
      <div className="mt-5 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-4xl font-black tracking-[-.05em] sm:text-5xl">{profile.displayName}</h1>
          <p className="mt-2 text-lg font-bold text-white/70">@{profile.handle}</p>
          {profile.bio&&<p className="mt-4 max-w-2xl leading-7 text-white/70">{profile.bio}</p>}
          <p className="mt-4 text-sm text-white/55">Member since {new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric"}).format(new Date(profile.memberSince))}</p>
        </div>
        {profile.sellerSlug&&<Link href={`/seller/${profile.sellerSlug}`} className="w-fit rounded-full bg-[#d4f44d] px-5 py-3 text-sm font-black text-[#173c31]">View seller inventory</Link>}
      </div>
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-3xl border border-black/10 bg-white p-5"><Star className="fill-current text-amber-500" size={21}/><p className="mt-4 text-3xl font-black">{rating(profile.sellerRating,profile.sellerReviewCount)}</p><p className="mt-1 text-sm font-bold">Seller rating</p><p className="text-xs text-[#63706a]">{profile.sellerReviewCount} verified review{profile.sellerReviewCount===1?"":"s"}</p></div>
      <div className="rounded-3xl border border-black/10 bg-white p-5"><Store className="text-[#287154]" size={21}/><p className="mt-4 text-3xl font-black">{profile.soldCount}</p><p className="mt-1 text-sm font-bold">Items sold</p><p className="text-xs text-[#63706a]">Completed, funds-released transactions</p></div>
      <div className="rounded-3xl border border-black/10 bg-white p-5"><Star className="fill-current text-amber-500" size={21}/><p className="mt-4 text-3xl font-black">{rating(profile.buyerRating,profile.buyerReviewCount)}</p><p className="mt-1 text-sm font-bold">Buyer rating</p><p className="text-xs text-[#63706a]">{profile.buyerReviewCount} verified review{profile.buyerReviewCount===1?"":"s"}</p></div>
      <div className="rounded-3xl border border-black/10 bg-white p-5"><ShoppingBag className="text-[#287154]" size={21}/><p className="mt-4 text-3xl font-black">{profile.boughtCount}</p><p className="mt-1 text-sm font-bold">Items bought</p><p className="text-xs text-[#63706a]">Completed, funds-released transactions</p></div>
    </section>

    <section className="mt-10">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Marketplace reputation</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Verified transaction reviews</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Reviews appear only after a completed transaction reaches the funds-released stage. Reviews are double-blind until both sides review or the visibility window expires.</p>
      <div className="mt-6"><ReviewList reviews={reviews}/></div>
    </section>
  </main></>;
}
