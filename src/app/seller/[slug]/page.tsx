import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Boxes,MapPin,PackageCheck,ShieldCheck,Truck } from "lucide-react";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { ReputationSummary } from "@/components/reputation-summary";
import { ReviewList } from "@/components/review-list";
import { getPublicSellerInventorySummary,getPublicSellerListingsPage } from "@/lib/data/marketplace";
import { getPublicSellerBySlug } from "@/lib/data/public-metadata";
import { getPublicMemberProfileById,getPublicMemberReviews } from "@/lib/data/reputation";
import { sellerBusinessKindLabel } from "@/lib/seller-business";
import { buildSellerMetadata } from "@/lib/metadata";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 try{return buildSellerMetadata(await getPublicSellerBySlug((await params).slug));}
 catch{return buildSellerMetadata(null);}
}

export default async function SellerPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{slug},query]=await Promise.all([params,searchParams]);
 const page=pageNumber(first(query.page));
 const pageSize=24;
 const seller=await getPublicSellerBySlug(slug);
 if(!seller)notFound();

 const [listingPage,summary,trust]=await Promise.all([
  getPublicSellerListingsPage(seller.id,{offset:(page-1)*pageSize,limit:pageSize}),
  getPublicSellerInventorySummary(seller.id).catch(()=>({activeCount:0,testedCount:0,collectionCount:0,warrantyCount:0,categoryNames:[]})),
  seller.ownerId?getPublicMemberProfileById(seller.ownerId).catch(()=>null):Promise.resolve(null)
 ]);
 const listings=listingPage.data;
 const reviews=trust?await getPublicMemberReviews(trust.id,12).catch(()=>[]):[];

 const pageHref=(target:number)=>target<=1?"/seller/"+seller.slug:"/seller/"+seller.slug+"?page="+target;

 return <><Header/><main>
  <section className="bg-[#173c31] text-white">
   <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
    <div className="flex flex-wrap items-center gap-3">
     <p className="text-xs font-black uppercase tracking-[.2em] text-[#d4f44d]">Seller profile</p>
     {seller.verified&&<span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold"><ShieldCheck size={14}/>Verified business</span>}
     <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{seller.sellerType==="business"?sellerBusinessKindLabel(seller.businessKind):"Private seller"}</span>
    </div>

    <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
     <div>
      <h1 className="text-4xl font-black tracking-[-.045em] sm:text-5xl">{seller.businessName}</h1>
      {trust&&<div className="mt-3 rounded-2xl bg-white px-4 py-3 text-[#173c31]"><ReputationSummary profile={trust}/></div>}
      <p className="mt-4 max-w-2xl text-lg leading-7 text-white/70">{seller.description}</p>
      <p className="mt-5 flex items-center gap-2 text-sm font-bold"><MapPin size={17} className="text-[#d4f44d]"/>{seller.location}{seller.postcode&&` · ${seller.postcode}`}</p>
     </div>

     <div className="grid grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-white/8 p-4">
      <div><p className="text-3xl font-black">{trust?.soldCount??0}</p><p className="text-xs text-white/60">Completed sales</p></div>
      <div><p className="text-3xl font-black">{trust?.sellerRating?.toFixed(1)??"New"}</p><p className="text-xs text-white/60">Seller rating</p></div>
      <div><p className="text-3xl font-black">{summary.activeCount}</p><p className="text-xs text-white/60">Active parts</p></div>
      <div><p className="text-3xl font-black">{trust?.sellerReviewCount??0}</p><p className="text-xs text-white/60">Verified reviews</p></div>
     </div>
    </div>
   </div>
  </section>

  <section className="border-b border-black/10 bg-[#f8f7f2]">
   <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-3 sm:px-6">
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4"><ShieldCheck className="text-[#287154]" size={20}/><div><p className="text-sm font-black">{seller.verified?"Verified seller":"Seller profile"}</p><p className="text-xs text-[#63706a]">{seller.sellerType==="business"?sellerBusinessKindLabel(seller.businessKind):"Private seller account"}</p></div></div>
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4"><PackageCheck className="text-[#287154]" size={20}/><div><p className="text-sm font-black">{summary.testedCount} tested listings</p><p className="text-xs text-[#63706a]">Testing varies by part</p></div></div>
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4"><Truck className="text-[#287154]" size={20}/><div><p className="text-sm font-black">{summary.collectionCount} collection options</p><p className="text-xs text-[#63706a]">{summary.warrantyCount} listings with warranty</p></div></div>
   </div>
  </section>

  <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
   <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
    <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Inventory</p><h2 className="mt-2 text-3xl font-black tracking-tight">Available listings</h2><p className="mt-2 text-sm text-[#63706a]">{summary.activeCount} active part{summary.activeCount===1?"":"s"} · page {page}</p></div>
    {summary.categoryNames.length>0&&<div className="flex max-w-2xl flex-wrap gap-2">{summary.categoryNames.map(category=><span key={category} className="rounded-full bg-[#eef1eb] px-3 py-1.5 text-xs font-black">{category}</span>)}</div>}
   </div>

   {listings.length?<><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map(item=><ProductCard key={item.id} item={item}/>)}</div>
    {(page>1||listingPage.hasMore)&&<nav aria-label="Seller inventory pages" className="mt-10 flex items-center justify-center gap-3">
     {page>1&&<Link href={pageHref(page-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}
     <span className="text-sm font-bold text-[#63706a]">Page {page}</span>
     {listingPage.hasMore&&<Link href={pageHref(page+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}
    </nav>}
   </>:<div className="mt-6 rounded-2xl border border-dashed border-black/20 p-8 text-[#63706a]"><Boxes className="mb-3"/><p>{page>1?"No active listings on this page.":"This seller has no active listings."}</p>{page>1&&<Link href={pageHref(1)} className="mt-4 inline-block font-black text-[#173c31] underline">Back to first page</Link>}</div>}
  </section>

  <section className="border-t border-black/10 bg-[#f8f7f2]">
   <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Reputation</p>
    <h2 className="mt-2 text-3xl font-black tracking-tight">Verified transaction reviews</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Only reviews tied to completed SecondPart transactions are published here.</p>
    <div className="mt-6 max-w-4xl"><ReviewList reviews={reviews}/></div>
   </div>
  </section>
 </main></>;
}
