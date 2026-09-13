import Link from "next/link";
import { Bug,LifeBuoy,Mail } from "lucide-react";
import { Header } from "@/components/header";
import { SupportRequestForm } from "@/components/support-request-form";
import { getCurrentUser } from "@/lib/auth";
import { getSupportRequestsForUser } from "@/lib/data/support";
import { getPublicSupportEmail } from "@/lib/public-contact";

export const dynamic="force-dynamic";

const topicLabels:Record<string,string>={
 account:"Account & sign in",
 seller:"Seller account",
 listing:"Listing",
 compatibility:"Vehicle compatibility",
 safety:"Safety / reporting",
 other:"Other"
};
const statusLabels={open:"Submitted",in_progress:"In review",resolved:"Resolved",closed:"Closed"} as const;
const statusClasses={
 open:"bg-sky-50 text-sky-800",
 in_progress:"bg-amber-50 text-amber-900",
 resolved:"bg-emerald-50 text-emerald-800",
 closed:"bg-[#eef1eb] text-[#47544e]"
} as const;
const submittedAt=(value:string)=>new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
const excerpt=(value:string)=>value.length>320?`${value.slice(0,319).trimEnd()}…`:value;

export default async function ContactPage(){
 const user=await getCurrentUser();
 const [supportEmail,supportRequests]=await Promise.all([
  Promise.resolve(getPublicSupportEmail()),
  user?getSupportRequestsForUser(user.id).catch(()=>null):Promise.resolve([])
 ]);
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <div className="rounded-3xl bg-[#173c31] p-6 text-white sm:p-8"><div className="flex items-center gap-2 text-[#d4f44d]"><LifeBuoy size={19}/><span className="text-xs font-black uppercase tracking-[.16em]">Support</span></div><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Contact SecondPart</h1><p className="mt-3 max-w-2xl text-white/70">Use this page for account, seller, listing or compatibility support. Marketplace safety concerns about a specific part should use the listing report tool where possible.</p></div>

  {supportEmail&&<section className="mt-6 rounded-3xl border border-black/10 bg-white p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#eef8f3] p-2 text-[#287154]"><Mail size={19}/></div><div><h2 className="text-xl font-black">Public support email</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">You can contact SecondPart without signing in. Do not send passwords, payment card details or API keys.</p><a href={`mailto:${supportEmail}`} className="mt-3 inline-block font-black text-[#287154] underline">{supportEmail}</a></div></div></section>}

  {user&&<section className="mt-6 rounded-3xl border border-[#cfe2d9] bg-[#f3faf6] p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-white p-2 text-[#287154]"><Bug size={19}/></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Closed Beta</p><h2 className="mt-1 text-xl font-black">Testing a pre-release build?</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Use the structured beta form for bugs, performance problems and UX feedback. It automatically includes the current build identifier so we can reproduce and retest the right version.</p><Link href="/beta-feedback" className="mt-4 inline-block rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Send beta feedback</Link></div></div></section>}

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6">{user?<><h2 className="text-xl font-black">Account-linked support request</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Signed-in requests are linked to your account so support can review the relevant marketplace context privately and reply inside SecondPart.</p><SupportRequestForm/></>:<div><h2 className="text-xl font-black">Account-linked support</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Sign in if you want to submit a private support request linked to your SecondPart account.{supportEmail?" You can also use the public support email above without signing in.":""}</p><Link href="/account?returnTo=%2Fcontact" className="mt-4 inline-block rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Sign in</Link></div>}</section>

  {user&&<section className="mt-6 rounded-3xl border border-black/10 bg-white p-6">
   <h2 className="text-xl font-black">Your support requests</h2>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">Track each request and open its private conversation to read or send replies. Resolved requests can be reopened by replying; closed requests are final and read-only.</p>
   {supportRequests===null?<p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">We could not load your support request history right now. You can still submit a new request above.</p>:supportRequests.length===0?<p className="mt-4 rounded-xl bg-[#f8f7f2] p-4 text-sm text-[#63706a]">No account-linked support requests yet.</p>:<div className="mt-5 space-y-3">{supportRequests.map(request=><article key={request.id} className="rounded-2xl border border-black/10 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black">{topicLabels[request.topic]??request.topic}</p><p className="mt-1 text-xs text-[#63706a]">Submitted {submittedAt(request.createdAt)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses[request.status]}`}>{statusLabels[request.status]}</span></div>
    <p className="mt-3 break-words text-sm leading-6 text-[#56625d]">{excerpt(request.message)}</p>
    <Link href={`/contact/${request.id}`} className="mt-3 inline-block text-sm font-black text-[#287154] underline">View conversation</Link>
   </article>)}</div>}
  </section>}
 </main></>;
}