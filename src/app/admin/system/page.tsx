import Link from "next/link";
import { CheckCircle2,CircleAlert,Settings2 } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { getPlatformReadiness } from "@/lib/platform-readiness";

export const dynamic="force-dynamic";

export default async function SystemReadinessPage(){
 await requireAdmin("/admin/system");
 const readiness=getPlatformReadiness();

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div>
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Admin · operations</p>
    <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">System readiness</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">This page only checks whether required deployment configuration exists. Secret values are never displayed.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <Link href="/admin/analytics" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Analytics</Link>
    <Link href="/admin/moderation" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Moderation</Link>
    <Link href="/admin/commerce" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Commerce</Link>
   </div>
  </div>

  <section className={"mt-8 rounded-[30px] p-6 sm:p-8 "+(readiness.launchCriticalReady?"bg-[#173c31] text-white":"bg-amber-50 text-amber-950")}>
   <div className="flex items-center gap-3">{readiness.launchCriticalReady?<CheckCircle2 size={28}/>:<CircleAlert size={28}/>}<div><p className="text-sm font-black">{readiness.readyCount}/{readiness.totalCount} integrations configured</p><h2 className="mt-1 text-2xl font-black">{readiness.launchCriticalReady?"Core commerce configuration is present":"Deployment configuration is still incomplete"}</h2></div></div>
  </section>

  <div className="mt-6 grid gap-3">
   {readiness.checks.map(check=><article key={check.key} className="flex items-start gap-4 rounded-2xl border border-black/10 bg-white p-5">
    <div className={"mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full "+(check.ready?"bg-emerald-100 text-emerald-800":"bg-red-50 text-red-800")}>{check.ready?<CheckCircle2 size={19}/>:<CircleAlert size={19}/>}</div>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{check.label}</h3><span className={"rounded-full px-2 py-0.5 text-[10px] font-black uppercase "+(check.ready?"bg-emerald-50 text-emerald-800":"bg-red-50 text-red-800")}>{check.ready?"Ready":"Missing"}</span></div><p className="mt-1 text-sm leading-6 text-[#63706a]">{check.detail}</p></div>
   </article>)}
  </div>

  <section className={"mt-8 rounded-[30px] p-6 sm:p-8 "+(readiness.mobileReleaseReady?"bg-[#173c31] text-white":"bg-[#f8f7f2] text-[#173c31]")}>
   <div className="flex items-center gap-3">{readiness.mobileReleaseReady?<CheckCircle2 size={28}/>:<CircleAlert size={28}/>}<div><p className="text-sm font-black">{readiness.mobileReadyCount}/{readiness.mobileTotalCount} Android release checks ready</p><h2 className="mt-1 text-2xl font-black">{readiness.mobileReleaseReady?"Android production configuration is ready":"Android release configuration still needs external credentials"}</h2></div></div>
  </section>

  <div className="mt-4 grid gap-3">
   {readiness.mobileReleaseChecks.map(check=><article key={check.key} className="flex items-start gap-4 rounded-2xl border border-black/10 bg-white p-5">
    <div className={"mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full "+(check.ready?"bg-emerald-100 text-emerald-800":"bg-amber-50 text-amber-900")}>{check.ready?<CheckCircle2 size={19}/>:<CircleAlert size={19}/>}</div>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{check.label}</h3><span className={"rounded-full px-2 py-0.5 text-[10px] font-black uppercase "+(check.ready?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-900")}>{check.ready?"Ready":"External setup"}</span></div><p className="mt-1 text-sm leading-6 text-[#63706a]">{check.detail}</p></div>
   </article>)}
  </div>

  <section className="mt-8 rounded-2xl bg-[#f8f7f2] p-5 text-sm leading-6 text-[#56625d]"><div className="flex items-center gap-2 font-black text-[#173c31]"><Settings2 size={18}/>Launch note</div><p className="mt-2">DVSA is intentionally not included in the core commerce readiness gate because SecondPart already has manual vehicle selection. It becomes a launch-quality enhancement as soon as the official registration lookup credentials are available.</p></section>
 </main></>;
}
