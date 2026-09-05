import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { requireUser } from "@/lib/auth";
import { getRecentlyViewedListings } from "@/lib/data/buyer-account";

export const dynamic="force-dynamic";

export default async function RecentlyViewedPage(){
 const user=await requireUser("/recently-viewed");
 const listings=await getRecentlyViewedListings(user.id,24);
 return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Recently viewed</h1>
  <p className="mt-2 text-[#63706a]">Parts you opened recently while signed in.</p>
  {listings.length?<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map(item=><ProductCard key={item.id} item={item}/>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><Clock3 className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No recently viewed parts yet</h2><Link href="/#marketplace" className="mt-3 inline-block font-black underline">Browse marketplace</Link></div>}
 </main></>;
}