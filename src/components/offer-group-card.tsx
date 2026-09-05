import Image from "next/image";
import Link from "next/link";
import { GitCompareArrows,MapPin,Store } from "lucide-react";
import type { OfferGroup } from "@/lib/offer-groups";
import { CompatibilityBadge } from "@/components/compatibility-badge";

export function OfferGroupCard({group,contextQuery=""}:{group:OfferGroup;contextQuery?:string}){
 const first=group.listings[0];
 const sellers=new Set(group.listings.map(item=>item.sellerId)).size;
 const lowest=group.listings[0]?.pricePence??0;
 const highest=group.listings[group.listings.length-1]?.pricePence??lowest;
 const params=new URLSearchParams(contextQuery);
 params.set("number",group.number);
 params.set("kind",group.kind);
 const href=`/compare?${params.toString()}`;
 const bestCompatibility=group.listings.find(item=>item.compatibility?.level==="confirmed")?.compatibility??group.listings.find(item=>item.compatibility?.level==="family_match")?.compatibility??null;
 return <article className="group overflow-hidden rounded-[22px] border-2 border-[#173c31]/15 bg-white transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(18,34,29,.12)]">
  <div className="relative h-52 bg-[#eef1eb]">{first.images[0]?<Image src={first.images[0].url} alt={first.images[0].alt||first.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover"/>:<div className="grid h-full place-items-center text-sm text-[#63706a]">No seller photo</div>}<span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#d4f44d] px-3 py-1.5 text-xs font-black text-[#173c31]"><GitCompareArrows size={14}/>{group.listings.length} offers</span></div>
  <div className="p-5">
   <div className="flex flex-wrap items-center gap-2">{bestCompatibility&&<CompatibilityBadge info={bestCompatibility} compact/>}<span className="inline-flex items-center gap-1 rounded-full bg-[#eef1eb] px-2.5 py-1 text-[11px] font-black"><Store size={13}/>{sellers} seller{sellers===1?"":"s"}</span></div>
   <h3 className="mt-3 text-lg font-black tracking-tight">{first.title}</h3>
   <p className="mt-1.5 font-mono text-sm text-[#63706a]">{group.kind==="oem"?"OE/OEM":"Part"} {group.number}</p>
   <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#63706a]"><span className="inline-flex items-center gap-1"><MapPin size={13}/>Multiple seller locations</span>{group.listings.some(item=>item.collectionAvailable)&&<span>Collection option available</span>}</div>
   <div className="mt-5 flex items-end justify-between gap-3 border-t border-black/8 pt-4"><div><p className="text-xs text-[#63706a]">From</p><span className="text-2xl font-black">£{(lowest/100).toLocaleString("en-GB",{minimumFractionDigits:2})}</span>{highest>lowest&&<p className="text-xs text-[#63706a]">to £{(highest/100).toLocaleString("en-GB",{minimumFractionDigits:2})}</p>}</div><Link href={href} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Compare offers</Link></div>
  </div>
 </article>;
}
