import Link from "next/link";
import { Flag,LifeBuoy,ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewSellerVerification,updateMarketplaceReport,updateSupportRequest } from "./actions";

export const dynamic="force-dynamic";

export default async function ModerationPage(){
 await requireAdmin("/admin/moderation");
 const supabase=await createSupabaseServerClient();
 const [verificationResult,reportsResult,supportResult]=await Promise.all([
  supabase.from("seller_verification_requests").select("id,status,message,requested_at,sellers(id,business_name,slug,location,verified_at)").eq("status","pending").order("requested_at"),
  supabase.from("marketplace_reports").select("id,reason,details,status,created_at,parts(id,title,slug),sellers(id,business_name,slug)").eq("status","open").order("created_at"),
  supabase.from("support_requests").select("id,topic,message,status,created_at,profiles(display_name)").in("status",["open","in_progress"]).order("created_at")
 ]);
 const verification=verificationResult.data??[];
 const reports=reportsResult.data??[];
 const support=supportResult.data??[];
 return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Admin</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Marketplace moderation</h1><p className="mt-2 max-w-2xl text-[#63706a]">Minimum launch moderation for seller verification and listing reports. This is intentionally not a full admin suite.</p>

  <section className="mt-10"><div className="flex items-center gap-2"><ShieldCheck size={20}/><h2 className="text-2xl font-black">Seller verification</h2><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{verification.length}</span></div>
   {verification.length?<div className="mt-5 grid gap-4">{verification.map(row=>{const seller=Array.isArray(row.sellers)?row.sellers[0]:row.sellers;return <article key={row.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><h3 className="text-xl font-black">{seller?.business_name??"Seller"}</h3><p className="mt-1 text-sm text-[#63706a]">{seller?.location} · requested {new Date(row.requested_at).toLocaleDateString("en-GB")}</p>{row.message&&<p className="mt-3 max-w-3xl text-sm leading-6">{row.message}</p>}{seller?.slug&&<Link href={"/seller/"+seller.slug} className="mt-3 inline-block text-sm font-black underline">View public seller</Link>}</div><form action={reviewSellerVerification} className="min-w-0 lg:w-96"><input type="hidden" name="requestId" value={row.id}/><textarea name="note" rows={2} maxLength={500} className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm" placeholder="Review note (optional)"/><div className="mt-2 flex gap-2"><button name="decision" value="approve" className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">Approve</button><button name="decision" value="reject" className="flex-1 rounded-xl bg-red-800 px-4 py-2.5 text-sm font-black text-white">Reject</button></div></form></div></article>;})}</div>:<p className="mt-4 rounded-2xl border border-dashed border-black/20 p-6 text-[#63706a]">No pending verification requests.</p>}
  </section>

  <section className="mt-12"><div className="flex items-center gap-2"><Flag size={20}/><h2 className="text-2xl font-black">Open reports</h2><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{reports.length}</span></div>
   {reports.length?<div className="mt-5 grid gap-4">{reports.map(row=>{const part=Array.isArray(row.parts)?row.parts[0]:row.parts;const seller=Array.isArray(row.sellers)?row.sellers[0]:row.sellers;return <article key={row.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-900">{row.reason.replaceAll("_"," ")}</span><h3 className="mt-3 text-xl font-black">{part?.title??seller?.business_name??"Marketplace report"}</h3><p className="mt-1 text-sm text-[#63706a]">{seller?.business_name&&"Seller: "+seller.business_name+" · "}Reported {new Date(row.created_at).toLocaleDateString("en-GB")}</p>{row.details&&<p className="mt-3 max-w-3xl text-sm leading-6">{row.details}</p>}{part?.slug&&<Link href={"/parts/"+part.slug} className="mt-3 inline-block text-sm font-black underline">View listing</Link>}</div><form action={updateMarketplaceReport} className="flex flex-wrap gap-2 lg:max-w-sm"><input type="hidden" name="reportId" value={row.id}/><button name="status" value="reviewed" className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">Mark reviewed</button><button name="status" value="dismissed" className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">Dismiss</button><button name="status" value="actioned" className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Actioned</button></form></div></article>;})}</div>:<p className="mt-4 rounded-2xl border border-dashed border-black/20 p-6 text-[#63706a]">No open marketplace reports.</p>}
  </section>
  <section className="mt-12"><div className="flex items-center gap-2"><LifeBuoy size={20}/><h2 className="text-2xl font-black">Support requests</h2><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{support.length}</span></div>
   {support.length?<div className="mt-5 grid gap-4">{support.map(row=>{const profile=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;return <article key={row.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{row.topic}</span><h3 className="mt-3 text-lg font-black">{profile?.display_name??"Account support"}</h3><p className="mt-1 text-xs text-[#8a918e]">{new Date(row.created_at).toLocaleString("en-GB")}</p><p className="mt-3 max-w-3xl text-sm leading-6">{row.message}</p></div><form action={updateSupportRequest} className="flex gap-2"><input type="hidden" name="requestId" value={row.id}/>{row.status==="open"&&<button name="status" value="in_progress" className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">In progress</button>}<button name="status" value="closed" className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Close</button></form></div></article>;})}</div>:<p className="mt-4 rounded-2xl border border-dashed border-black/20 p-6 text-[#63706a]">No open support requests.</p>}
  </section>
 </main></>;
}
