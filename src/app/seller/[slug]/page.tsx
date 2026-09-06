import { notFound } from "next/navigation";
import { Boxes,MapPin,PackageCheck,ShieldCheck,Truck } from "lucide-react";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { ReputationSummary } from "@/components/reputation-summary";
import { ReviewList } from "@/components/review-list";
import { getSellerBySlug,getSellerListings } from "@/lib/data/marketplace";
import { getPublicMemberProfileById,getPublicMemberReviews } from "@/lib/data/reputation";

export const dynamic="force-dynamic";

export default async function SellerPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const seller=await getSellerBySlug(slug);
  if(!seller)notFound();

  const [listings,trust]=await Promise.all([
    getSellerListings(seller.id),
    getPublicMemberProfileById(seller.ownerId).catch(()=>null)
  ]);
  const reviews=trust?await getPublicMemberReviews(trust.id,12).catch(()=>[]):[];

  const categories=[...new Set(listings.map(item=>item.category.name))].sort();
  const collectionCount=listings.filter(item=>item.collectionAvailable).length;
  const warrantyCount=listings.filter(item=>item.warrantyDays>0).length;
  const testedCount=listings.filter(item=>item.testingStatus==="tested_working"||item.testingStatus==="removed_from_running_vehicle").length;

  return <><Header/><main>
    <section className="bg-[#173c31] text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#d4f44d]">Seller profile</p>
          {seller.verified&&<span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold"><ShieldCheck size={14}/>Verified business</span>}
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold capitalize">{seller.sellerType} seller</span>
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
            <div><p className="text-3xl font-black">{listings.length}</p><p className="text-xs text-white/60">Active parts</p></div>
            <div><p className="text-3xl font-black">{trust?.sellerReviewCount??0}</p><p className="text-xs text-white/60">Verified reviews</p></div>
          </div>
        </div>
      </div>
    </section>

    <section className="border-b border-black/10 bg-[#f8f7f2]">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-3 sm:px-6">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4"><ShieldCheck className="text-[#287154]" size={20}/><div><p className="text-sm font-black">{seller.verified?"Verified seller":"Seller profile"}</p><p className="text-xs text-[#63706a]">{seller.sellerType==="business"?"Business / trader account":"Private seller account"}</p></div></div>
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4"><PackageCheck className="text-[#287154]" size={20}/><div><p className="text-sm font-black">{testedCount} tested listings</p><p className="text-xs text-[#63706a]">Testing varies by part</p></div></div>
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4"><Truck className="text-[#287154]" size={20}/><div><p className="text-sm font-black">{collectionCount} collection options</p><p className="text-xs text-[#63706a]">{warrantyCount} listings with warranty</p></div></div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Inventory</p><h2 className="mt-2 text-3xl font-black tracking-tight">Available listings</h2></div>
        {categories.length>0&&<div className="flex max-w-2xl flex-wrap gap-2">{categories.slice(0,8).map(category=><span key={category} className="rounded-full bg-[#eef1eb] px-3 py-1.5 text-xs font-black">{category}</span>)}</div>}
      </div>
      {listings.length?<div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map(item=><ProductCard key={item.id} item={item}/>)}</div>:<div className="mt-6 rounded-2xl border border-dashed border-black/20 p-8 text-[#63706a]"><Boxes className="mb-3"/><p>This seller has no active listings.</p></div>}
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
