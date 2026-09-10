import Link from "next/link";
import { AlertTriangle,BellRing,CheckCircle2,RefreshCw,Smartphone } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/identifiers";
import { isFcmPushConfigured } from "@/lib/push/fcm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { queueFcmSmokeTest } from "./actions";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const errorCopy=(code:string|undefined)=>{
 if(code==="firebase-not-configured")return "Firebase server credentials are not configured in this environment.";
 if(code==="invalid-device"||code==="device-missing")return "That device is no longer an enabled SecondPart push target.";
 if(code==="device-load")return "Device registration could not be loaded.";
 if(code==="queue")return "The smoke notification could not be queued.";
 return null;
};

export default async function PushTestPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin("/admin/system/push-test");
 const params=await searchParams;
 const notificationId=(first(params.notification)??"").trim();
 const errorMessage=errorCopy(first(params.error));
 const firebaseConfigured=isFcmPushConfigured();
 const admin=createSupabaseAdminClient();
 const {data:devices,error:devicesError}=await admin
  .from("mobile_push_devices")
  .select("id,profile_id,platform,app_id,build_channel,last_seen_at,updated_at")
  .eq("enabled",true)
  .order("last_seen_at",{ascending:false})
  .limit(100);
 if(devicesError)throw new Error("Push device readiness is temporarily unavailable.");

 const profileIds=[...new Set((devices??[]).map(row=>row.profile_id))];
 const {data:profiles,error:profilesError}=profileIds.length
  ?await admin.from("profiles").select("id,display_name,handle").in("id",profileIds)
  :{data:[],error:null};
 if(profilesError)throw new Error("Push target profiles are temporarily unavailable.");
 const profileMap=new Map((profiles??[]).map(row=>[row.id,row] as const));
 const deviceCountByProfile=new Map<string,number>();
 for(const row of devices??[])deviceCountByProfile.set(row.profile_id,(deviceCountByProfile.get(row.profile_id)??0)+1);

 let smoke:null|{id:string;profile_id:string;created_at:string}=null;
 let deliveryRows:Array<{id:number;device_id:string;status:string;attempts:number;last_error:string|null;updated_at:string}>=[];
 if(isUuid(notificationId)){
  const {data,error}=await admin.from("notifications").select("id,profile_id,created_at").eq("id",notificationId).eq("type","system_push_test").maybeSingle();
  if(error)throw new Error("Smoke-test notification status is temporarily unavailable.");
  smoke=data;
  if(smoke){
   const {data:outbox,error:outboxError}=await admin.from("mobile_push_outbox").select("id,device_id,status,attempts,last_error,updated_at").eq("notification_id",smoke.id).order("id");
   if(outboxError)throw new Error("Smoke-test delivery status is temporarily unavailable.");
   deliveryRows=outbox??[];
  }
 }
 const allServerSent=deliveryRows.length>0&&deliveryRows.every(row=>row.status==="sent");
 const smokeProfile=smoke?profileMap.get(smoke.profile_id):null;

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Release QA · FCM</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Physical push smoke test</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#63706a]">Queues a fixed SecondPart test notification through the normal notifications → outbox → FCM path. Device tokens are never displayed and the form cannot send arbitrary push content.</p></div><Link href="/admin/system" className="w-fit rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-black">System readiness</Link></div>

  <section className={`mt-8 rounded-3xl border p-5 sm:p-6 ${firebaseConfigured?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}><div className="flex items-start gap-3">{firebaseConfigured?<CheckCircle2 size={23} className="mt-0.5 shrink-0 text-emerald-800"/>:<AlertTriangle size={23} className="mt-0.5 shrink-0 text-amber-900"/>}<div><h2 className="font-black">{firebaseConfigured?"Firebase server sender is configured":"Firebase server sender is not configured"}</h2><p className="mt-1 text-sm leading-6 text-[#56625d]">{firebaseConfigured?"A smoke notification can be queued after a real app installation registers an enabled device.":"Configure the Production Firebase service account before attempting physical FCM E2E. No test notification will be queued while this is missing."}</p></div></div></section>

  {errorMessage&&<div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">{errorMessage}</div>}

  {smoke&&<section className={`mt-6 rounded-3xl border p-5 sm:p-6 ${allServerSent?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}>
   <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-wide text-[#63706a]">Latest smoke notification</p><h2 className="mt-1 text-xl font-black">{allServerSent?"FCM server delivery accepted":"Delivery still needs verification"}</h2><p className="mt-2 text-sm text-[#56625d]">Target: {smokeProfile?`${smokeProfile.display_name} · @${smokeProfile.handle}`:"registered profile"} · Notification {smoke.id.slice(0,8).toUpperCase()}</p></div><Link href={`/admin/system/push-test?notification=${smoke.id}`} className="inline-flex items-center gap-2 rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm font-black"><RefreshCw size={15}/>Refresh status</Link></div>
   <div className="mt-4 grid gap-3">{deliveryRows.length?deliveryRows.map(row=><div key={row.id} className="rounded-2xl bg-white/70 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">Device …{row.device_id.slice(-8)}</p><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.status==="sent"?"bg-emerald-100 text-emerald-800":row.status==="failed"?"bg-red-100 text-red-800":"bg-amber-100 text-amber-900"}`}>{row.status.replaceAll("_"," ")}</span></div><p className="mt-1 text-xs text-[#63706a]">Attempts: {row.attempts} · updated {new Date(row.updated_at).toLocaleString("en-GB")}{row.last_error?` · ${row.last_error}`:""}</p></div>):<p className="rounded-2xl bg-white/70 p-4 text-sm text-[#63706a]">The database trigger has not produced an outbox row for this notification.</p>}</div>
   {allServerSent&&<div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-sm leading-6 text-emerald-950"><strong>Server-side delivery is not the physical PASS.</strong> Put the app in foreground and background, confirm the notification is actually visible on the phone, then tap it and verify that SecondPart opens the intended notifications destination.</div>}
  </section>}

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><BellRing size={20}/></span><div><h2 className="text-xl font-black">Enabled physical devices</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">Choosing one registration targets that account through the normal notification trigger. If the same account has multiple enabled devices, the production pipeline intentionally queues the notification for all of them.</p></div></div>
   {(devices??[]).length?<div className="mt-5 grid gap-3">{(devices??[]).map(row=>{const profile=profileMap.get(row.profile_id);return <article key={row.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-black/10 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 items-start gap-3"><Smartphone size={19} className="mt-0.5 shrink-0 text-[#287154]"/><div className="min-w-0"><p className="font-black">{profile?`${profile.display_name} · @${profile.handle}`:"Registered SecondPart account"}</p><p className="mt-1 text-xs text-[#63706a]">{row.platform} · {row.build_channel} · {row.app_id} · device …{row.id.slice(-8)} · last seen {new Date(row.last_seen_at).toLocaleString("en-GB")} · {deviceCountByProfile.get(row.profile_id)??1} enabled device(s) on account</p></div></div><form action={queueFcmSmokeTest}><input type="hidden" name="deviceId" value={row.id}/><button disabled={!firebaseConfigured} className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Queue fixed smoke test</button></form></article>;})}</div>:<div className="mt-5 rounded-2xl border border-dashed border-black/20 bg-[#f8f7f2] p-6"><p className="font-black">No enabled device is registered yet.</p><p className="mt-2 text-sm leading-6 text-[#63706a]">Install the intended Android build, sign in through the normal app flow and grant notification permission. The mobile registration endpoint will create the device record; do not paste or seed an FCM token manually.</p></div>}
  </section>
 </main></>;
}
