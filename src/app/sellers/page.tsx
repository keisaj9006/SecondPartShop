import Link from "next/link";
import { MapPin,ShieldCheck,Star,Store } from "lucide-react";
import { Header } from "@/components/header";
import { getSellers } from "@/lib/data/marketplace";
import { getPublicMemberProfileById } from "@/lib/data/reputation";

export const dynamic="force-dynamic";

export default async function SellersPage(){
  const sellers=await getSellers();
  const trustEntries=await Promise.all(sellers.map(async seller=>[
    seller.id,
    await getPublicMemberProfileById(seller.ownerId).catch(()=>null)
  ] as const));
  const trustMap=new Map(trustEntries);

  return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">UK supplier network</p>
    <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Sellers</h1>
    <p className="mt-2 text-[#63706a]">Garages, breakers, specialists and private sellers listing on SecondPart.</p>

    {sellers.length?<div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {sellers.map(s=>{
        const trust=trustMap.get(s.id);
        return <Link href={`/seller/${s.slug}`} key={s.id} className="rounded-3xl border border-black/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl">
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#173c31] text-xl font-black text-[#d4f44d]">{s.businessName.charAt(0)}</span>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-bold capitalize">{s.sellerType}</span>
              {s.verified&&<span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"><ShieldCheck size={14}/>Verified</span>}
            </div>
          </div>

          <h2 className="mt-6 text-xl font-black">{s.businessName}</h2>
          {trust&&<p className="mt-1 text-xs font-bold text-[#63706a]">@{trust.handle}</p>}
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#63706a]">{s.description}</p>

          {trust&&<div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#f8f7f2] p-3">
            <div className="flex items-center gap-2"><Star size={16} className="fill-current text-amber-500"/><div><p className="font-black">{trust.sellerRating?.toFixed(1)??"New"}</p><p className="text-[11px] text-[#63706a]">{trust.sellerReviewCount} reviews</p></div></div>
            <div className="flex items-center gap-2"><Store size={16} className="text-[#287154]"/><div><p className="font-black">{trust.soldCount}</p><p className="text-[11px] text-[#63706a]">items sold</p></div></div>
          </div>}

          <p className="mt-5 flex items-center gap-2 text-sm font-semibold"><MapPin size={16}/>{s.location}</p>
        </Link>;
      })}
    </div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white p-8 text-center">
      <h2 className="text-xl font-black">No sellers are listed yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#63706a]">Seller profiles will appear here as garages and parts specialists join SecondPart.</p>
      <Link href="/sell" className="mt-5 inline-block rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Sell parts on SecondPart</Link>
    </div>}
  </main></>;
}
