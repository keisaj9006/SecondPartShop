import { Header } from "@/components/header";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { requireUser } from "@/lib/auth";
import { getSavedListings } from "@/lib/data/marketplace";
export const dynamic="force-dynamic";
export default async function SavedPage(){const user=await requireUser("/saved");const result=await getSavedListings(user.id);return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Saved parts</h1><p className="mt-2 text-[#63706a]">These listings are stored in your account and remain saved between sessions.</p>{result.error&&<p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">{result.error}</p>}{result.data.length?<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.data.map(item=><ProductCard key={item.id} item={item} saved/>)}</div>:!result.error&&<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white py-20 text-center"><h2 className="text-xl font-bold">No saved parts yet</h2><Link href="/#marketplace" className="mt-3 inline-block font-bold underline">Browse marketplace</Link></div>}</main></>}
