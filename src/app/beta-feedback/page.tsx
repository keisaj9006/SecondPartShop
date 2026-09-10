import Link from "next/link";
import { Bug,CheckCircle2,LifeBuoy } from "lucide-react";
import { Header } from "@/components/header";
import { BetaFeedbackForm } from "@/components/beta-feedback-form";
import { requireUser } from "@/lib/auth";

export const dynamic="force-dynamic";

export default async function BetaFeedbackPage(){
 await requireUser("/beta-feedback");
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <section className="rounded-3xl bg-[#173c31] p-6 text-white sm:p-8">
   <div className="flex items-center gap-2 text-[#d4f44d]"><Bug size={19}/><span className="text-xs font-black uppercase tracking-[.16em]">Closed Beta</span></div>
   <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Help us test SecondPart</h1>
   <p className="mt-3 max-w-2xl text-white/70">Found something broken, confusing or unexpectedly slow? Send one clear report and it will go directly into the SecondPart review queue with the current build identifier.</p>
  </section>

  <section className="mt-6 grid gap-3 rounded-3xl border border-black/10 bg-[#f8f7f2] p-6 sm:grid-cols-3">
   <div className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 shrink-0 text-[#287154]" size={17}/><span><strong>Reproduce it once</strong><br/><span className="text-[#63706a]">Confirm the issue happens again if it is safe to do so.</span></span></div>
   <div className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 shrink-0 text-[#287154]" size={17}/><span><strong>One issue per report</strong><br/><span className="text-[#63706a]">This makes fixes and retesting traceable.</span></span></div>
   <div className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 shrink-0 text-[#287154]" size={17}/><span><strong>No sensitive data</strong><br/><span className="text-[#63706a]">Never paste passwords or payment card information.</span></span></div>
  </section>

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6 sm:p-8">
   <h2 className="text-2xl font-black">Report an issue or improvement</h2>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">For a crash or blocker, choose <strong>Blocker</strong>. For ideas that do not stop you using the app, choose <strong>Suggestion</strong>.</p>
   <BetaFeedbackForm/>
  </section>

  <div className="mt-6 flex items-center gap-2 text-sm text-[#63706a]"><LifeBuoy size={16}/><span>Need normal account or marketplace help instead?</span><Link href="/contact" className="font-black text-[#287154] underline">Contact support</Link></div>
 </main></>;
}
