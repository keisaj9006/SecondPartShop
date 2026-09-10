import Link from "next/link";
import { AlertTriangle,CheckCircle2,CircleDashed,FlaskConical,ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { getCommerceE2EDiagnostic,getCommerceE2EPreflight,type CommerceE2ECheckStatus } from "@/lib/data/commerce-e2e";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const money=(pence:number,currency="GBP")=>new Intl.NumberFormat("en-GB",{style:"currency",currency}).format(pence/100);
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());
const badge=(status:CommerceE2ECheckStatus)=>status==="pass"?"bg-emerald-50 text-emerald-800 border-emerald-200":status==="fail"?"bg-red-50 text-red-800 border-red-200":status==="pending"?"bg-amber-50 text-amber-900 border-amber-200":"bg-slate-50 text-slate-700 border-slate-200";
const icon=(status:CommerceE2ECheckStatus)=>status==="pass"?<CheckCircle2 size={17}/>:status==="fail"?<AlertTriangle size={17}/>:<CircleDashed size={17}/>;
const stripeModeLabel=(value:string)=>value==="test"?"Test mode":value==="live"?"LIVE — blocked":value==="missing"?"Missing":"Unverified";

export default async function CommerceE2EPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin("/admin/commerce/e2e");
 const params=await searchParams;
 const orderId=(first(params.order)??"").trim();
 const [preflight,diagnostic]=await Promise.all([
  getCommerceE2EPreflight(),
  orderId?getCommerceE2EDiagnostic(orderId):Promise.resolve(null)
 ]);
 const searched=Boolean(orderId);
 const liveStripeDetected=preflight.stripeApiMode==="live";

 const preflightChecks=[
  {label:"Stripe API mode",value:stripeModeLabel(preflight.stripeApiMode),ready:preflight.stripeApiMode==="test",danger:liveStripeDetected,detail:"Release QA is allowed only with Stripe test-mode server credentials. Secret values are never shown here."},
  {label:"Webhook signing",value:preflight.stripeWebhookConfigured?"Configured":"Missing",ready:preflight.stripeWebhookConfigured,danger:false,detail:"A Stripe webhook signing secret must be configured so provider events can be verified normally."},
  {label:"HTTPS site origin",value:preflight.siteUrlConfigured?"Configured":"Missing / unsafe",ready:preflight.siteUrlConfigured,danger:false,detail:"SecondPart needs a configured HTTPS canonical origin for checkout return and webhook-facing release QA."},
  {label:"Buyer accounts",value:String(preflight.buyerProfiles),ready:preflight.buyerProfiles>0,danger:false,detail:"At least one buyer profile is required for the controlled checkout."},
  {label:"Active listings",value:String(preflight.activeListings),ready:preflight.activeListings>0,danger:false,detail:"There must be an active part with stock available."},
  {label:"Checkout-ready listings",value:String(preflight.checkoutReadyListings),ready:preflight.checkoutReadyListings>0,danger:false,detail:"The test listing must belong to a seller who can receive Stripe transfers."},
  {label:"Payout-ready sellers",value:String(preflight.payoutReadySellers),ready:preflight.payoutReadySellers>0,danger:false,detail:"Stripe Connect must report complete onboarding, transfers and payouts enabled."},
  {label:"Payout recovery",value:preflight.payoutRecoveryReady?"Ready":"Missing",ready:preflight.payoutRecoveryReady,danger:false,detail:"Release database must expose the service-only payout recovery RPCs."},
  {label:"Existing orders",value:String(preflight.existingOrders),ready:true,danger:false,detail:"Informational only. Zero is expected before the first genuine E2E order."}
 ];

 return <><Header/><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Release QA</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Commerce E2E verifier</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#63706a]">Read-only verification of a real Stripe test-mode transaction. This page never advances fulfilment, changes payment state or forces a payout.</p></div>
   <div className="flex flex-wrap gap-2"><Link href="/admin/system" className="w-fit rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-black">System readiness</Link><Link href="/admin/commerce" className="w-fit rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-black">Back to commerce</Link></div>
  </div>

  <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><FlaskConical size={21}/></span><div><h2 className="text-xl font-black">Real E2E preflight</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">A genuine release test requires Stripe test mode, verified webhook configuration, an HTTPS site origin, a buyer account, an active checkout-ready listing, a payout-ready Stripe Connect seller and the deployed payout-recovery schema. Live-money credentials fail closed.</p></div></div>
   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {preflightChecks.map(item=><div key={item.label} className={`rounded-2xl border p-4 ${item.ready?"border-emerald-200 bg-emerald-50":item.danger?"border-red-200 bg-red-50":"border-amber-200 bg-amber-50"}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wide text-[#63706a]">{item.label}</p>{item.ready?<CheckCircle2 size={17} className="text-emerald-800"/>:<AlertTriangle size={17} className={item.danger?"text-red-800":"text-amber-900"}/>}</div><p className="mt-2 text-2xl font-black">{item.value}</p><p className="mt-2 text-xs leading-5 text-[#63706a]">{item.detail}</p></div>)}
   </div>
   <div className={`mt-4 rounded-2xl border p-4 text-sm ${preflight.readyForRealE2E?"border-emerald-200 bg-emerald-50 text-emerald-900":liveStripeDetected?"border-red-200 bg-red-50 text-red-950":"border-amber-200 bg-amber-50 text-amber-950"}`}>
    <p className="font-black">{preflight.readyForRealE2E?"Environment is ready for a controlled real Stripe test-mode transaction.":liveStripeDetected?"Stripe LIVE mode detected — release QA is blocked to prevent accidental real-money testing.":"Real Stripe E2E is blocked by environment readiness."}</p>
    {!preflight.readyForRealE2E&&<ul className="mt-2 list-disc space-y-1 pl-5">{preflight.blockers.map(item=><li key={item}>{item}</li>)}</ul>}
   </div>
  </section>

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <h2 className="text-xl font-black">Inspect a real test order</h2><p className="mt-1 text-sm text-[#63706a]">Paste the UUID shown in Purchases / Commerce after completing the genuine Stripe test-mode checkout.</p>
   <form method="get" className="mt-4 flex flex-col gap-3 sm:flex-row"><input name="order" defaultValue={orderId} placeholder="Order UUID" className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-[#287154]"/><button className="rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Verify order</button></form>
   {searched&&!diagnostic&&<p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">No order matched that UUID.</p>}
  </section>

  {diagnostic&&<>
   <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-[#287154]">Order {diagnostic.orderId.slice(0,8).toUpperCase()}</p><h2 className="mt-1 text-2xl font-black">{money(diagnostic.totalPence,diagnostic.currency)}</h2><p className="mt-1 text-sm text-[#63706a]">Order: {label(diagnostic.orderStatus)} · Payment: {label(diagnostic.paymentStatus)} · Stage: {label(diagnostic.stage)}</p></div><div className="flex gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{diagnostic.passCount} pass</span><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-900">{diagnostic.pendingCount} pending</span><span className={`rounded-full px-3 py-1 text-xs font-black ${diagnostic.failCount?"bg-red-50 text-red-800":"bg-[#eef1eb] text-[#52605a]"}`}>{diagnostic.failCount} fail</span></div></div>
    {diagnostic.failCount>0&&<div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="mt-0.5 shrink-0" size={18}/><p><strong>Do not mark this transaction E2E complete.</strong> One or more persisted states are internally inconsistent.</p></div>}
    {diagnostic.failCount===0&&diagnostic.stage==="completed"&&<div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldCheck className="mt-0.5 shrink-0" size={18}/><p><strong>Happy-path transaction is internally complete.</strong> Payment, fulfilment and provider payout evidence are present.</p></div>}
   </section>

   <section className="mt-6 grid gap-4 lg:grid-cols-2">
    <div className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><h2 className="text-xl font-black">Order checks</h2><div className="mt-4 grid gap-3">{diagnostic.checks.map(item=><div key={item.id} className={`rounded-2xl border p-4 ${badge(item.status)}`}><div className="flex items-center gap-2 font-black">{icon(item.status)}{item.label}</div><p className="mt-1 text-xs leading-5 opacity-80">{item.detail}</p></div>)}</div></div>
    <div className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><h2 className="text-xl font-black">Audit timeline</h2>{diagnostic.events.length?<div className="mt-4 grid gap-3">{diagnostic.events.map(event=><div key={event.id} className="rounded-2xl bg-[#f8f7f2] p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-black">{label(event.type)}</p><p className="text-xs text-[#63706a]">{new Date(event.createdAt).toLocaleString("en-GB")}</p></div><p className="mt-1 text-xs text-[#63706a]">{label(event.source)}{event.orderItemId?` · Item ${event.orderItemId.slice(0,8).toUpperCase()}`:""}</p><p className="mt-2 text-sm">{event.detail}</p></div>)}</div>:<p className="mt-4 rounded-2xl bg-[#f8f7f2] p-4 text-sm text-[#63706a]">No payment/order/case events have been recorded yet.</p>}</div>
   </section>

   <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><h2 className="text-xl font-black">Order items</h2><div className="mt-4 grid gap-5">{diagnostic.items.map(item=><article key={item.id} className="rounded-2xl border border-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{item.partTitle}</p><p className="mt-1 text-xs text-[#63706a]">{item.sellerName} · {label(item.deliveryMethod)} · seller net {money(item.sellerNetPence)}</p></div><div className="text-right text-xs font-bold text-[#63706a]"><p>Fulfilment: {label(item.fulfilmentStatus)}</p><p>Payout: {label(item.payoutStatus)}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{item.checks.map(row=><div key={row.id} className={`rounded-xl border p-3 ${badge(row.status)}`}><div className="flex items-center gap-2 text-sm font-black">{icon(row.status)}{row.label}</div><p className="mt-1 text-xs leading-5 opacity-80">{row.detail}</p></div>)}</div></article>)}</div></section>
  </>}
 </main></>;
}
