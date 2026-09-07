import Link from "next/link";
import { Boxes,FileSpreadsheet,Rocket,ShieldCheck,Sparkles,Wrench } from "lucide-react";
import { Header } from "@/components/header";
import { FoundingSellerApplicationForm } from "@/components/founding-seller-application-form";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function FoundingSellersPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const sourceRaw=first(params.source)??"website";
 const source=/^[a-zA-Z0-9._-]{1,80}$/.test(sourceRaw)?sourceRaw:"website";
 return <><Header/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
  <section className="overflow-hidden rounded-[34px] bg-[#173c31] p-6 text-white sm:p-9 lg:p-11">
   <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#d4f44d]"><Rocket size={16}/>Founding Seller Programme</p>
   <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-.05em] sm:text-6xl">Bring your parts inventory to SecondPart before the wider marketplace launch.</h1>
   <p className="mt-5 max-w-3xl text-base leading-7 text-white/72 sm:text-lg">For UK breakers, ATFs, garages and established parts businesses that want a structured route from existing stock to searchable, compatibility-aware SecondPart listings.</p>
   <div className="mt-7 flex flex-wrap gap-2"><a href="#apply" className="rounded-xl bg-[#d4f44d] px-5 py-3 font-black text-[#173c31]">Apply now</a><Link href="/sell" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-black text-white">See seller tools</Link></div>
  </section>

  <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
   {[
    [FileSpreadsheet,"Bulk inventory","CSV import creates drafts first, with validation and remediation queues before publication."],
    [Sparkles,"AI listing assistance","Draft titles and descriptions from seller-provided facts and photos while keeping identifiers human-verified."],
    [ShieldCheck,"Compatibility evidence","Donor vehicles, OE/OEM data and confirmed fitments feed listing trust and Part Passport evidence."],
    [Wrench,"Buy + Fit network","Eligible workshops can separately apply as garage partners to quote fitting labour."]
   ].map(([Icon,title,body])=><article key={String(title)} className="rounded-3xl border border-black/10 bg-white p-5"><Icon size={21} className="text-[#287154]"/><h2 className="mt-5 text-lg font-black">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">{String(body)}</p></article>)}
  </section>

  <section className="mt-10 grid gap-7 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
   <div>
    <p className="text-xs font-black uppercase tracking-[.18em] text-[#287154]">How onboarding works</p>
    <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">A defined path, not a blank seller dashboard.</h2>
    <div className="mt-6 grid gap-3">
     {[
      ["1","Seller profile","Set the correct business type and public identity."],
      ["2","Verification + payouts","Submit business verification and complete Stripe payout onboarding."],
      ["3","Inventory source","Add donor vehicles, use AI/manual entry or bulk CSV depending on your workflow."],
      ["4","Evidence remediation","Work through photos, fit evidence, technical data and stock queues."],
      ["5","Go live","Publish only listings that meet SecondPart publication rules."]
     ].map(([number,title,body])=><div key={number} className="flex gap-3 rounded-2xl bg-[#f4f7f2] p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173c31] text-sm font-black text-[#d4f44d]">{number}</span><div><p className="font-black">{title}</p><p className="mt-1 text-sm leading-6 text-[#63706a]">{body}</p></div></div>)}
    </div>
    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Important:</strong> SecondPart does not silently publish imported stock. Real photos and sufficient part-identity / compatibility evidence remain publication gates.</div>
   </div>
   <div id="apply"><FoundingSellerApplicationForm source={source}/></div>
  </section>

  <section className="mt-10 rounded-3xl border border-black/10 bg-white p-6">
   <div className="flex items-start gap-3"><Boxes className="mt-1 text-[#287154]"/><div><h2 className="text-xl font-black">Already have a SecondPart seller account?</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Use the seller dashboard launch path instead of submitting another programme application.</p><Link href="/dashboard" className="mt-4 inline-block text-sm font-black underline">Open seller dashboard</Link></div></div>
  </section>
 </main></>;
}
