import Link from "next/link";
import {BellRing,CheckCircle2,CircleAlert,ShieldCheck} from "lucide-react";
import {Header} from "@/components/header";
import {requireAdmin} from "@/lib/auth";
import {runCriticalAlertSmokeTest} from "./actions";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function CriticalAlertSmokePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin("/admin/system/alerts");
 const params=await searchParams;
 const configured=Boolean(process.env.OPS_ALERT_WEBHOOK_URL?.trim());
 const rawKind=process.env.OPS_ALERT_WEBHOOK_KIND?.trim().toLowerCase();
 const kind=rawKind==="slack"||rawKind==="discord"?rawKind:"generic";
 const result=first(params.result);
 const reason=first(params.reason);
 const status=first(params.status);
 const delivered=result==="delivered";

 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#287154]"><ShieldCheck size={16}/>Admin · release operations</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Critical alert smoke test</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Verify that SecondPart can deliver a fixed, privacy-safe production alert to the configured operations destination. The webhook URL and token are never displayed.</p></div>
   <Link href="/admin/system" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">System readiness</Link>
  </div>

  <section className={"mt-8 rounded-[30px] border p-6 "+(configured?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50")}>
   <div className="flex items-start gap-3">{configured?<CheckCircle2 size={26} className="text-emerald-800"/>:<CircleAlert size={26} className="text-amber-900"/>}<div><p className="text-xs font-black uppercase tracking-[.14em] text-[#63706a]">Destination configuration</p><h2 className="mt-1 text-2xl font-black">{configured?"Critical alert destination is configured":"Critical alert destination is missing"}</h2><p className="mt-2 text-sm leading-6 text-[#56625d]">Adapter: <strong>{kind}</strong>. {configured?"Only an HTTPS endpoint is accepted by the sender.":"Set OPS_ALERT_WEBHOOK_URL in the Production environment before release."}</p></div></div>
  </section>

  {result&&<section className={"mt-6 rounded-3xl border p-6 "+(delivered?"border-emerald-200 bg-emerald-50":"border-red-200 bg-red-50")}>
   <div className="flex items-start gap-3">{delivered?<CheckCircle2 size={24} className="text-emerald-800"/>:<CircleAlert size={24} className="text-red-800"/>}<div><h2 className="text-xl font-black">{delivered?"Destination accepted the smoke alert":"Smoke alert was not delivered"}</h2><p className="mt-2 text-sm leading-6 text-[#56625d]">Result: <strong>{reason??"unknown"}</strong>{status?` · HTTP ${status}`:""}. {delivered?"Confirm the SecondPart smoke-test message is visible in the real alert destination before marking the release P0 complete.":"Review Production alert configuration before retrying."}</p></div></div>
  </section>}

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6">
   <div className="flex items-start gap-3"><div className="rounded-xl bg-[#eef8f3] p-2 text-[#287154]"><BellRing size={20}/></div><div><h2 className="text-xl font-black">Send fixed smoke alert</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">This action sends only a predefined SecondPart critical-alert test record. It does not accept arbitrary message content, webhook URLs or tokens from the browser.</p></div></div>
   <form action={runCriticalAlertSmokeTest} className="mt-5"><button disabled={!configured} className="rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Send critical alert smoke test</button></form>
  </section>

  <section className="mt-6 rounded-2xl bg-[#f8f7f2] p-5 text-sm leading-6 text-[#56625d]"><strong className="text-[#173c31]">Release evidence:</strong> record the RC/release SHA, smoke-test timestamp, destination type, HTTP result and confirmation that the alert was visible to the operations recipient. Never copy the webhook URL, bearer token or unrelated alert content into release notes.</section>
 </main></>;
}
