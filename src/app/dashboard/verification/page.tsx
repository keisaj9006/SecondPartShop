import Link from "next/link";
import { CheckCircle2,Clock3,ShieldCheck,XCircle } from "lucide-react";
import { Header } from "@/components/header";
import { SellerVerificationRequestForm } from "@/components/seller-verification-request-form";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";

export default async function SellerVerificationPage(){
 const {user}=await requireSeller("/dashboard/verification");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return <><Header/><main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl font-black">Create your seller profile first</h1><Link href="/dashboard" className="mt-4 inline-block font-black underline">Back to seller setup</Link></main></>;
 const supabase=await createSupabaseServerClient();
 const {data:request}=await supabase
  .from("seller_verification_requests")
  .select("status,requested_at,reviewed_at,review_note")
  .eq("seller_id",seller.id)
  .order("requested_at",{ascending:false})
  .limit(1)
  .maybeSingle();

 return <><Header/><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <Link href="/dashboard" className="text-sm font-black underline">Back to dashboard</Link>
  <div className="mt-6 rounded-3xl bg-[#173c31] p-6 text-white sm:p-8"><div className="flex items-center gap-2 text-[#d4f44d]"><ShieldCheck size={20}/><span className="text-xs font-black uppercase tracking-[.16em]">Seller trust</span></div><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Business verification</h1><p className="mt-3 max-w-2xl text-white/70">Verification is manually reviewed. Sellers cannot grant themselves the verified badge.</p></div>

  {seller.verified?<section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><div className="flex items-center gap-3"><CheckCircle2 className="text-emerald-700"/><div><h2 className="text-xl font-black text-emerald-950">Verified business</h2><p className="mt-1 text-sm text-emerald-900/70">Your public seller profile can display the SecondPart verified badge.</p></div></div></section>:
  request?.status==="pending"?<section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6"><div className="flex items-center gap-3"><Clock3 className="text-amber-700"/><div><h2 className="text-xl font-black text-amber-950">Review pending</h2><p className="mt-1 text-sm text-amber-900/70">Requested {new Date(request.requested_at).toLocaleDateString("en-GB")}. No verified badge is shown until an administrator approves the request.</p></div></div></section>:
  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6">{request?.status==="rejected"&&<div className="mb-5 rounded-2xl bg-red-50 p-4"><div className="flex items-center gap-2 font-black text-red-900"><XCircle size={18}/>Previous request was not approved</div>{request.review_note&&<p className="mt-2 text-sm text-red-900/70">{request.review_note}</p>}</div>}<h2 className="text-xl font-black">Request manual verification</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">This creates a review request only. Later we can add document collection if the launch process requires it.</p><SellerVerificationRequestForm/></section>}
 </main></>;
}
