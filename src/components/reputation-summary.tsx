import Link from "next/link";
import { ShoppingBag,Star,Store } from "lucide-react";
import type { PublicMemberProfile } from "@/lib/types";

const ratingLabel=(rating:number|null,count:number)=>rating===null||count===0?"New":rating.toFixed(1);

export function ReputationSummary({
  profile,
  compact=false,
  linkProfile=true
}:{
  profile:PublicMemberProfile;
  compact?:boolean;
  linkProfile?:boolean;
}){
  const content=<>
    <span className="inline-flex items-center gap-1 font-black">
      <Star size={compact?14:16} className="fill-current text-amber-500"/>
      {ratingLabel(profile.sellerRating,profile.sellerReviewCount)}
      <span className="font-semibold text-[#63706a]">({profile.sellerReviewCount})</span>
    </span>
    <span className="text-black/20">·</span>
    <span className="inline-flex items-center gap-1"><Store size={compact?13:15}/><strong>{profile.soldCount}</strong> sold</span>
    <span className="text-black/20">·</span>
    <span className="inline-flex items-center gap-1"><ShoppingBag size={compact?13:15}/><strong>{profile.boughtCount}</strong> bought</span>
  </>;
  const classes=compact?"flex flex-wrap items-center gap-1.5 text-xs text-[#63706a]":"flex flex-wrap items-center gap-2 text-sm text-[#56625d]";
  return <div className={classes}>
    {linkProfile?<Link href={`/member/${profile.handle}`} className="font-black text-[#173c31] hover:underline">@{profile.handle}</Link>:<span className="font-black text-[#173c31]">@{profile.handle}</span>}
    <span className="text-black/20">·</span>
    {content}
  </div>;
}
