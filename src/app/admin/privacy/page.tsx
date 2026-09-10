import Link from "next/link";
import {ShieldCheck,Trash2} from "lucide-react";
import {Header} from "@/components/header";
import {requireAdmin} from "@/lib/auth";
import {getAccountDeletionQaPreflight} from "@/lib/account-deletion";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());
const yesNo=(value:boolean)=>value?"Yes":"No";

type AdminPrivacyPageProps={
 searchParams:Promise<{requestId?:string|string[]}>;
};

export default async function AdminPrivacyPage({searchParams}:AdminPrivacyPageProps){
 await requireAdmin("/admin/privacy");
 const params=await searchParams;
 const rawRequestId=Array.isArray(params.requestId)?params.requestId[0]:params.requestId;
 const selectedRequestId=rawRequestId?.trim()??"";
 const preflight=selectedRequestId?await getAccountDeletionQaPreflight(selectedRequestId):null;

 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("account_deletion_requests")
  .select("id,profile_id,status,reason,requested_at,updated_at,profiles(display_name,handle)")
  .order("requested_at",{ascending:true})
  .limit(200);
 if(error)throw new Error("Privacy requests are temporarily unavailable.");

 const rows=data??[];
 const pending=rows.filter(item=>["requested","blocked","failed"].includes(item.status));
 const history=rows.filter(item=>!["requested","blocked","failed"].includes(item.status));
 const one=<T,>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

 return <><Header/><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#287154]"><ShieldCheck size={16}/>Admin · privacy operations</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Account deletion requests</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#63706a]">Operational queue for user deletion requests. A request does not automatically erase authentication, transaction, dispute, payment or legally retained records.</p></div>
   <div className="flex flex-wrap gap-2"><Link href="/admin/system" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">System readiness</Link><Link href="/admin/moderation" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Moderation</Link></div>
  </div>

  <section className="mt-8 grid gap-3 sm:grid-cols-3">
   <div className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-[#63706a]">Pending</p><p className="mt-2 text-3xl font-black">{pending.length}</p></div>
   <div className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-[#63706a]">History</p><p className="mt-2 text-3xl font-black">{history.length}</p></div>
   <div className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-[#63706a]">Deletion processor</p><p className="mt-2 text-lg font-black">Automated</p><p className="mt-1 text-xs leading-5 text-[#63706a]">Maintenance retries safe requests automatically and blocks deletion while commerce, payout, dispute or moderation obligations remain active.</p></div>
  </section>

  <section data-account-deletion-qa-preflight="read-only" className="mt-8 rounded-3xl border border-[#c8ddd4] bg-[#f4faf7] p-5 sm:p-6">
   <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
    <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">QA preflight (read-only)</p><h2 className="mt-1 text-2xl font-black">Verify a deletion request before destructive E2E</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#56625d]">Enter the deletion request UUID from the disposable QA account. This view only reads operational state. It does not claim, process, retry, unblock or delete the account.</p></div>
   </div>
   <form action="/admin/privacy" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
    <input name="requestId" defaultValue={selectedRequestId} aria-label="Deletion request UUID" placeholder="Deletion request UUID" className="min-w-0 flex-1 rounded-2xl border border-black/15 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-[#287154]"/>
    <button type="submit" className="rounded-2xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Run read-only preflight</button>
   </form>

   {preflight&&!preflight.found&&<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Preflight not available:</strong> {preflight.reason==="invalid_request_id"?"enter a valid request UUID.":"no deletion request exists for that UUID."}</div>}

   {preflight?.found&&<div className="mt-5">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[#63706a]">Request state</p><p className="mt-2 font-black">{label(preflight.status)}</p><p className="mt-1 text-xs text-[#63706a]">Attempts: {preflight.attemptCount}</p></div>
     <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[#63706a]">Stored blocker</p><p className="mt-2 font-black">{preflight.blockerCode?label(preflight.blockerCode):"None recorded"}</p><p className="mt-1 text-xs text-[#63706a]">A blank stored blocker is not proof that processing is safe; the worker re-checks blockers when it claims the request.</p></div>
     <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[#63706a]">Identity state</p><p className="mt-2 font-black">Profile: {preflight.profileExists?"present":"missing"}</p><p className="mt-1 text-xs text-[#63706a]">Auth: {preflight.authIdentity}</p></div>
     <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[#63706a]">Processor state</p><p className="mt-2 font-black">Queue candidate: {yesNo(preflight.workerCandidate)}</p><p className="mt-1 text-xs text-[#63706a]">Identity detached: {yesNo(preflight.identityDetached)} · Error recorded: {yesNo(preflight.processorErrorPresent)}</p></div>
    </div>
    <div className="mt-3 rounded-2xl bg-white p-4 text-xs leading-6 text-[#56625d]">
     <p><strong>Request UUID:</strong> <span className="font-mono break-all">{preflight.requestId}</span></p>
     <p><strong>Target profile UUID:</strong> <span className="font-mono break-all">{preflight.profileId??"not retained"}</span></p>
     <p><strong>Requested:</strong> {new Date(preflight.requestedAt).toLocaleString("en-GB")}</p>
     <p><strong>Processing started:</strong> {preflight.processingStartedAt?new Date(preflight.processingStartedAt).toLocaleString("en-GB"):"not started"}</p>
     <p><strong>Completed:</strong> {preflight.completedAt?new Date(preflight.completedAt).toLocaleString("en-GB"):"not completed"}</p>
    </div>
    <div className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Safety rule:</strong> use this panel only to verify the disposable QA request and capture redacted evidence. Execute deletion only through the normal maintenance worker described in the E2E runbook.</div>
   </div>}
  </section>

  <section className="mt-8">
   <div className="flex items-center gap-2"><Trash2 size={18} className="text-red-700"/><h2 className="text-2xl font-black">Pending requests</h2></div>
   {pending.length?<div className="mt-4 grid gap-3">{pending.map(item=>{
    const profile=one(item.profiles);
    return <article key={item.id} className="rounded-3xl border border-red-100 bg-white p-5">
     <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{profile?.display_name??"SecondPart member"}</p><p className="mt-1 text-sm text-[#63706a]">{profile?.handle?"@"+profile.handle+" · ":""}Profile {item.profile_id?item.profile_id.slice(0,8).toUpperCase():"anonymised"}</p></div><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-800">{label(item.status)}</span></div>
     <p className="mt-3 text-sm text-[#63706a]">Requested {new Date(item.requested_at).toLocaleString("en-GB")}</p>
     {item.reason&&<div className="mt-3 rounded-2xl bg-[#f8f7f2] p-4 text-sm"><strong>Member reason</strong><p className="mt-1 leading-6 text-[#63706a]">{item.reason}</p></div>}
     <div className="mt-4 flex flex-wrap items-center gap-2"><Link href={`/admin/privacy?requestId=${encodeURIComponent(item.id)}`} className="rounded-full border border-[#287154]/30 bg-[#f4faf7] px-3 py-2 text-xs font-black text-[#173c31]">Open QA preflight</Link></div>
     <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Before processing:</strong> verify active orders, open transaction cases, refunds/chargebacks, seller payouts, tax/accounting retention and any legal preservation requirement. Final erasure/anonymisation must follow the approved privacy retention policy.</div>
    </article>;
   })}</div>:<div className="mt-4 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-sm text-[#63706a]">No pending account deletion requests.</div>}
  </section>

  {history.length>0&&<section className="mt-10"><h2 className="text-2xl font-black">Request history</h2><div className="mt-4 divide-y divide-black/10 rounded-3xl border border-black/10 bg-white px-5">{history.slice(0,100).map(item=>{const profile=one(item.profiles);return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-black">{profile?.display_name??"SecondPart member"} {profile?.handle?"· @"+profile.handle:""}</p><p className="text-xs text-[#63706a]">{new Date(item.requested_at).toLocaleString("en-GB")}</p></div><div className="flex items-center gap-2"><Link href={`/admin/privacy?requestId=${encodeURIComponent(item.id)}`} className="rounded-full border border-black/10 px-3 py-1 text-xs font-black">QA preflight</Link><span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black">{label(item.status)}</span></div></div>;})}</div></section>}

  <section className="mt-8 rounded-2xl bg-[#f8f7f2] p-5 text-sm leading-6 text-[#56625d]"><strong className="text-[#173c31]">Why there is no “Delete now” button:</strong> marketplace accounts can own payment, dispute, review and transaction records that may require retention or controlled anonymisation. SecondPart must not cascade-delete regulated or evidential records simply because a UI button was pressed.</section>
 </main></>;
}
