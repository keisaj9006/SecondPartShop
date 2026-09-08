import Link from "next/link";
import { BellRing,CheckCircle2,CircleAlert,RotateCcw,Settings2 } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { getPlatformReadiness } from "@/lib/platform-readiness";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { refreshMissingSellerGeo,retryExhaustedPushes } from "./actions";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function SystemReadinessPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin("/admin/system");
 const params=await searchParams;
 const readiness=getPlatformReadiness();
 const admin=createSupabaseAdminClient();
 const [listingResult,sellerPostcodeResult,sellerGeoResult,garageActiveResult,garageGeoResult,pushDevicesResult,pushPendingResult,pushProcessingResult,pushRetryingResult,pushExhaustedResult,oldestPushResult]=await Promise.all([
  admin.rpc("admin_active_listing_checkout_readiness"),
  admin.from("sellers").select("id",{count:"exact",head:true}).not("postcode","is",null),
  admin.from("sellers").select("id",{count:"exact",head:true}).not("postcode","is",null).not("latitude","is",null).not("longitude","is",null),
  admin.from("garage_partners").select("id",{count:"exact",head:true}).eq("status","active"),
  admin.from("garage_partners").select("id",{count:"exact",head:true}).eq("status","active").not("latitude","is",null).not("longitude","is",null),
  admin.from("mobile_push_devices").select("id",{count:"exact",head:true}).eq("enabled",true),
  admin.from("mobile_push_outbox").select("id",{count:"exact",head:true}).eq("status","pending"),
  admin.from("mobile_push_outbox").select("id",{count:"exact",head:true}).eq("status","processing"),
  admin.from("mobile_push_outbox").select("id",{count:"exact",head:true}).eq("status","failed").lt("attempts",5),
  admin.from("mobile_push_outbox").select("id",{count:"exact",head:true}).eq("status","failed").gte("attempts",5),
  admin.from("mobile_push_outbox").select("created_at,status,attempts,last_error").neq("status","sent").order("created_at",{ascending:true}).limit(1).maybeSingle()
 ]);
 const listingReadiness=listingResult.data;
 const listingRow=listingReadiness?.[0];
 const activeListings=Number(listingRow?.active_listings??0);
 const checkoutReadyListings=Number(listingRow?.checkout_ready_listings??0);
 const checkoutBlockedListings=Number(listingRow?.checkout_blocked_listings??0);
 const marketplaceInventoryReady=checkoutBlockedListings===0;
 const sellersWithPostcode=sellerPostcodeResult.count??0;
 const geocodedSellers=sellerGeoResult.count??0;
 const missingSellerGeo=Math.max(0,sellersWithPostcode-geocodedSellers);
 const activeGarages=garageActiveResult.count??0;
 const geocodedActiveGarages=garageGeoResult.count??0;
 const missingGarageGeo=Math.max(0,activeGarages-geocodedActiveGarages);
 const locationReady=missingSellerGeo===0&&missingGarageGeo===0;
 const geoUpdated=Number(first(params["geo-updated"])??0);
 const geoUnresolved=Number(first(params["geo-unresolved"])??0);
 const geoError=first(params["geo-error"]);
 const enabledPushDevices=pushDevicesResult.count??0;
 const pendingPush=pushPendingResult.count??0;
 const processingPush=pushProcessingResult.count??0;
 const retryingPush=pushRetryingResult.count??0;
 const exhaustedPush=pushExhaustedResult.count??0;
 const oldestPush=oldestPushResult.data;
 const oldestPushAt=oldestPush?new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(oldestPush.created_at)):null;
 const pushHealthy=exhaustedPush===0;
 const pushRetried=Number(first(params["push-retried"])??-1);
 const pushError=first(params["push-error"]);

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div>
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Admin · operations</p>
    <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">System readiness</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">This page only checks whether required deployment configuration exists. Secret values are never displayed.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <Link href="/admin/analytics" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Analytics</Link>
    <Link href="/admin/privacy" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Privacy</Link>
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

  <section className={"mt-8 rounded-[30px] border p-6 sm:p-8 "+(marketplaceInventoryReady?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50")}>
   <div className="flex items-start gap-3">{marketplaceInventoryReady?<CheckCircle2 size={26} className="text-emerald-800"/>:<CircleAlert size={26} className="text-amber-900"/>}<div><p className="text-xs font-black uppercase tracking-[.14em] text-[#63706a]">Marketplace inventory launch gate</p><h2 className="mt-1 text-2xl font-black">{marketplaceInventoryReady?"All active listings are checkout-ready":"Some active listings are not currently sellable"}</h2><p className="mt-2 text-sm leading-6 text-[#56625d]">{checkoutReadyListings} of {activeListings} active listings belong to sellers with completed payout setup. {checkoutBlockedListings>0?checkoutBlockedListings+" active listing(s) are preview/legacy inventory and must be resolved before public launch.":"No active listing is blocked by seller payout readiness."}</p></div></div>
  </section>

  <section className={"mt-8 rounded-[30px] border p-6 sm:p-8 "+(locationReady?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50")}>
   <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
    <div>
     <div className="flex items-center gap-3">{locationReady?<CheckCircle2 size={26} className="text-emerald-800"/>:<CircleAlert size={26} className="text-amber-900"/>}<div><p className="text-xs font-black uppercase tracking-[.14em] text-[#63706a]">Location & distance readiness</p><h2 className="mt-1 text-2xl font-black">{locationReady?"Marketplace distance data is ready":"Some marketplace location data needs geocoding"}</h2></div></div>
     <p className="mt-3 text-sm leading-6 text-[#56625d]">{geocodedSellers} of {sellersWithPostcode} seller profile(s) with a postcode have trusted coordinates. {geocodedActiveGarages} of {activeGarages} active Buy + Fit garage(s) have trusted coordinates.</p>
     {missingSellerGeo>0&&<p className="mt-2 text-sm font-bold text-amber-950">{missingSellerGeo} seller profile(s) can be safely re-geocoded from their stored postcode/outcode.</p>}
     {missingGarageGeo>0&&<p className="mt-2 text-sm font-bold text-amber-950">{missingGarageGeo} active garage profile(s) are missing geo and should be reviewed before Buy + Fit location launch.</p>}
     {geoUpdated>0&&<p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-900">Updated trusted geo for {geoUpdated} seller profile(s).</p>}
     {geoUnresolved>0&&<p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-950">{geoUnresolved} seller postcode/outcode value(s) could not be resolved and were left unchanged.</p>}
     {geoError&&<p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-900">Seller geo refresh could not be completed. No guessed coordinates were written.</p>}
    </div>
    {missingSellerGeo>0&&<form action={refreshMissingSellerGeo}><button className="shrink-0 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Re-geocode seller locations</button></form>}
   </div>
  </section>

  <section className={"mt-8 rounded-[30px] border p-6 sm:p-8 "+(pushHealthy?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50")}>
   <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
    <div>
     <div className="flex items-center gap-3">{pushHealthy?<BellRing size={26} className="text-emerald-800"/>:<CircleAlert size={26} className="text-amber-900"/>}<div><p className="text-xs font-black uppercase tracking-[.14em] text-[#63706a]">Push delivery operations</p><h2 className="mt-1 text-2xl font-black">{pushHealthy?"Push delivery queue is healthy":"Push delivery needs attention"}</h2></div></div>
     <p className="mt-3 text-sm leading-6 text-[#56625d]">{enabledPushDevices} enabled device(s) · {pendingPush} pending · {processingPush} processing · {retryingPush} retrying · {exhaustedPush} exhausted.</p>
     {oldestPush&&<p className="mt-2 text-sm text-[#56625d]">Oldest unsent push queued at {oldestPushAt} UTC · {oldestPush.status} · attempt {oldestPush.attempts}{oldestPush.last_error?" · "+oldestPush.last_error:""}.</p>}
     {pushRetried>=0&&<p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-900">{pushRetried>0?"Queued "+pushRetried+" exhausted push(es) for controlled retry.":"There were no exhausted pushes to retry."}</p>}
     {pushError&&<p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-900">Push retry could not be prepared. No queue records were discarded.</p>}
    </div>
    {exhaustedPush>0&&<form action={retryExhaustedPushes}><button className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white"><RotateCcw size={16}/>Retry up to 100</button></form>}
   </div>
  </section>

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
