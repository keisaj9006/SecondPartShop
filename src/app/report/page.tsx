import Link from "next/link";
import { Flag,ShieldAlert } from "lucide-react";
import { Header } from "@/components/header";
import { MarketplaceReportForm } from "@/components/marketplace-report-form";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const safeReturnTo=(value:string|undefined)=>value&&value.startsWith("/")&&!value.startsWith("//")?value:"/";

export default async function ReportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireUser("/report");
 const params=await searchParams;
 const partId=first(params.part)??"";
 const returnTo=safeReturnTo(first(params.returnTo));
 const supabase=await createSupabaseServerClient();
 const {data:part}=partId?await supabase.from("parts").select("id,title,slug,sellers(business_name)").eq("id",partId).maybeSingle():{data:null};
 if(!part)return <><Header/><main className="mx-auto max-w-2xl px-4 py-16"><h1 className="text-3xl font-black">Listing not available</h1><p className="mt-2 text-[#63706a]">We could not load the listing you wanted to report.</p><Link href={returnTo} className="mt-5 inline-block font-black underline">Go back</Link></main></>;
 const seller=Array.isArray(part.sellers)?part.sellers[0]:part.sellers;
 return <><Header/><main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <Link href={returnTo} className="text-sm font-black underline">Back to listing</Link>
  <div className="mt-6 rounded-3xl bg-[#173c31] p-6 text-white sm:p-8"><div className="flex items-center gap-2 text-[#d4f44d]"><Flag size={18}/><span className="text-xs font-black uppercase tracking-[.16em]">Marketplace safety</span></div><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Report a listing</h1><p className="mt-3 text-white/70">Reports are reviewed separately from buyer/seller disputes. Do not include passwords or payment credentials.</p></div>
  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-[#287154]"/><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#287154]">Listing</p><h2 className="mt-1 text-xl font-black">{part.title}</h2>{seller?.business_name&&<p className="mt-1 text-sm text-[#63706a]">Seller: {seller.business_name}</p>}</div></div><MarketplaceReportForm partId={part.id} returnTo={returnTo}/></section>
 </main></>;
}
