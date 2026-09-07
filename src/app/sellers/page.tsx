import Link from "next/link";
import { MapPin,ShieldCheck,Star,Store } from "lucide-react";
import { Header } from "@/components/header";
import { getSellerDirectoryPage } from "@/lib/data/seller-directory";
import { sellerBusinessKindLabel } from "@/lib/seller-business";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export default async function SellersPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const page=pageNumber(first(params.page));
  const pageSize=24;
  const result=await getSellerDirectoryPage((page-1)*pageSize,pageSize).catch(()=>({items:[],pagination:{offset:0,limit:pageSize,hasMore:false}}));
  const sellers=result.items;

  return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">UK supplier network</p>
    <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Sellers</h1>
    <p className="mt-2 text-[#63706a]">Garages, breakers, specialists and private sellers listing on SecondPart.</p>

    {sellers.length?<><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {sellers.map(s=><Link href={"/seller/"+s.slug} key={s.id} className="rounded-3xl border border-black/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl">
        <div className="flex items-center justify-between">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#173c31] text-xl font-black text-[#d4f44d]">{s.businessName.charAt(0)}</span>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-bold">{s.sellerType==="business"?sellerBusinessKindLabel(s.businessKind):"Private"}</span>
            {s.verified&&<span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"><ShieldCheck size={14}/>Verified</span>}
          </div>
        </div>

        <h2 className="mt-6 text-xl font-black">{s.businessName}</h2>
        {s.handle&&<p className="mt-1 text-xs font-bold text-[#63706a]">@{s.handle} · {s.soldCount} sold · {s.boughtCount} bought</p>}
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#63706a]">{s.description}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#f8f7f2] p-3">
          <div className="flex items-center gap-2"><Star size={16} className="fill-current text-amber-500"/><div><p className="font-black">{s.sellerRating?.toFixed(1)??"New"}</p><p className="text-[11px] text-[#63706a]">{s.sellerReviewCount} reviews</p></div></div>
          <div className="flex items-center gap-2"><Store size={16} className="text-[#287154]"/><div><p className="font-black">{s.soldCount}</p><p className="text-[11px] text-[#63706a]">items sold</p></div></div>
        </div>

        <p className="mt-5 flex items-center gap-2 text-sm font-semibold"><MapPin size={16}/>{s.location}</p>
      </Link>)}
    </div>
    {(page>1||result.pagination.hasMore)&&<nav aria-label="Seller directory pages" className="mt-10 flex items-center justify-center gap-3">
      {page>1&&<Link href={page===2?"/sellers":"/sellers?page="+(page-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}
      <span className="text-sm font-bold text-[#63706a]">Page {page}</span>
      {result.pagination.hasMore&&<Link href={"/sellers?page="+(page+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}
    </nav>}</>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white p-8 text-center">
      <h2 className="text-xl font-black">No sellers are listed yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#63706a]">Seller profiles will appear here as garages and parts specialists join SecondPart.</p>
      <Link href="/sell" className="mt-5 inline-block rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Sell parts on SecondPart</Link>
    </div>}
  </main></>;
}
