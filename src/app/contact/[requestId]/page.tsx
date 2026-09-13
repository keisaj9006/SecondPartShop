import Link from "next/link";
import { notFound } from "next/navigation";
import { LifeBuoy,LockKeyhole } from "lucide-react";
import { Header } from "@/components/header";
import { SupportReplyForm } from "@/components/support-reply-form";
import { requireUser } from "@/lib/auth";
import { getSupportRequestConversationForUser } from "@/lib/data/support";

export const dynamic="force-dynamic";

const statusLabels={open:"Submitted",in_progress:"In review",resolved:"Resolved",closed:"Closed"} as const;
const statusClasses={
 open:"bg-sky-50 text-sky-800",
 in_progress:"bg-amber-50 text-amber-900",
 resolved:"bg-emerald-50 text-emerald-800",
 closed:"bg-[#eef1eb] text-[#47544e]"
} as const;
const stamp=(value:string)=>new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));

export default async function SupportConversationPage({params}:{params:Promise<{requestId:string}>}){
 const {requestId}=await params;
 const user=await requireUser(`/contact/${requestId}`);
 const conversation=await getSupportRequestConversationForUser(user.id,requestId);
 if(!conversation)notFound();
 const {request,messages}=conversation;
 const closed=request.status==="closed";
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <Link href="/contact" className="text-sm font-black text-[#287154] underline">← Back to support</Link>
  <div className="mt-5 rounded-3xl bg-[#173c31] p-6 text-white sm:p-8"><div className="flex items-center gap-2 text-[#d4f44d]"><LifeBuoy size={19}/><span className="text-xs font-black uppercase tracking-[.16em]">Support conversation</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black tracking-[-.04em]">{request.topic.replaceAll("_"," ")}</h1><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses[request.status]}`}>{statusLabels[request.status]}</span></div><p className="mt-3 text-sm text-white/65">Opened {stamp(request.createdAt)}</p></div>

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.14em] text-[#287154]">Your original request</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#39443f]">{request.message}</p></section>

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><h2 className="text-xl font-black">Conversation</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Replies here are visible to you and SecondPart support. Internal moderator notes are not part of this conversation.</p>{messages.length===0?<p className="mt-5 rounded-2xl bg-[#f8f7f2] p-4 text-sm text-[#63706a]">No replies yet. Support will respond here when there is an update.</p>:<div className="mt-5 space-y-3">{messages.map(message=><article key={message.id} className={`rounded-2xl p-4 ${message.senderRole==="admin"?"bg-[#eef8f3]":"bg-[#f8f7f2]"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black">{message.senderRole==="admin"?"SecondPart support":"You"}</p><p className="text-xs text-[#7a8580]">{stamp(message.createdAt)}</p></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#39443f]">{message.message}</p></article>)}</div>}</section>

  {closed?<section className="mt-6 rounded-3xl border border-black/10 bg-[#f8f7f2] p-5 sm:p-6"><div className="flex items-start gap-3"><LockKeyhole size={19} className="mt-0.5 shrink-0 text-[#47544e]"/><div><h2 className="font-black">This support conversation is closed</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">It is now read-only and you can no longer reply. If you need help with a new issue, create a new support request.</p></div></div></section>:<section className="mt-6 rounded-3xl border border-[#cfe2d9] bg-[#f3faf6] p-5 sm:p-6"><h2 className="text-xl font-black">Reply to support</h2>{request.status==="resolved"&&<p className="mt-2 text-sm leading-6 text-[#63706a]">This request is resolved. Sending a reply will reopen it so support can review the new information.</p>}<SupportReplyForm requestId={request.id}/></section>}
 </main></>;
}