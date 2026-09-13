import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye,FileLock2,LifeBuoy } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminAddSupportRequestNote,adminReplyToSupportRequest,updateSupportRequest } from "@/app/admin/moderation/actions";

export const dynamic="force-dynamic";

const stamp=(value:string)=>new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));

export default async function AdminSupportConversationPage({params}:{params:Promise<{requestId:string}>}){
 const {requestId}=await params;
 await requireAdmin(`/admin/support/${requestId}`);
 const supabase=await createSupabaseServerClient();
 const {data:request,error:requestError}=await supabase
  .from("support_requests")
  .select("id,profile_id,topic,message,status,created_at,updated_at")
  .eq("id",requestId)
  .maybeSingle();
 if(requestError)throw new Error("Support request could not be loaded.");
 if(!request)notFound();
 const [{data:profile},{data:messages,error:messageError},{data:notes,error:notesError}]=await Promise.all([
  supabase.from("profiles").select("display_name,handle").eq("id",request.profile_id).maybeSingle(),
  supabase.from("support_request_messages").select("id,sender_profile_id,sender_role,message,created_at").eq("support_request_id",request.id).order("created_at",{ascending:true}).limit(100),
  supabase.from("support_request_internal_notes").select("id,admin_profile_id,note,created_at").eq("support_request_id",request.id).order("created_at",{ascending:true}).limit(100)
 ]);
 if(messageError)throw new Error("Support conversation could not be loaded.");
 if(notesError)throw new Error("Internal support notes could not be loaded.");
 const closed=request.status==="closed";
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <Link href="/admin/moderation" className="text-sm font-black text-[#287154] underline">← Back to moderation</Link>
  <div className="mt-5 rounded-3xl bg-[#173c31] p-6 text-white sm:p-8"><div className="flex items-center gap-2 text-[#d4f44d]"><LifeBuoy size={19}/><span className="text-xs font-black uppercase tracking-[.16em]">Support conversation</span></div><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-black tracking-[-.04em]">{profile?.display_name??"Account support"}</h1><p className="mt-1 text-sm text-white/65">{profile?.handle?`@${profile.handle} · `:""}{request.topic.replaceAll("_"," ")} · opened {stamp(request.created_at)}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase">{request.status.replaceAll("_"," ")}</span></div></div>

  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
   <div className="space-y-6">
    <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><Eye size={18}/><h2 className="text-xl font-black">Customer-visible conversation</h2></div><p className="mt-2 text-sm leading-6 text-[#63706a]">The original request and every reply in this section are visible to the customer.</p><article className="mt-5 rounded-2xl bg-[#f8f7f2] p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-black">Customer · original request</p><p className="text-xs text-[#7a8580]">{stamp(request.created_at)}</p></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{request.message}</p></article>{(messages??[]).map(message=><article key={message.id} className={`mt-3 rounded-2xl p-4 ${message.sender_role==="admin"?"bg-[#eef8f3]":"bg-[#f8f7f2]"}`}><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-black">{message.sender_role==="admin"?"SecondPart support":"Customer"}</p><p className="text-xs text-[#7a8580]">{stamp(message.created_at)}</p></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.message}</p></article>)}</section>

    <section className="rounded-3xl border border-[#cfe2d9] bg-[#f3faf6] p-5 sm:p-6"><h2 className="text-xl font-black">Reply to customer</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Customer-visible reply. Use the internal note panel for information the customer must not see.</p>{closed?<p className="mt-4 rounded-xl bg-white p-4 text-sm font-bold text-[#56625d]">This request is closed. Customer-visible replies are disabled and the conversation is final.</p>:<form action={adminReplyToSupportRequest} className="mt-5"><input type="hidden" name="requestId" value={request.id}/><label className="block text-sm font-bold">Message<textarea name="message" required maxLength={2000} rows={6} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Write a reply that the customer can see."/></label><label className="mt-4 block text-sm font-bold">Status after reply<select name="nextStatus" defaultValue="in_progress" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3"><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label><button className="mt-4 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Send customer-visible reply</button></form>}</section>
   </div>

   <aside className="space-y-6">
    <section className="rounded-3xl border border-black/10 bg-white p-5"><h2 className="text-lg font-black">Request status</h2>{closed?<p className="mt-3 text-sm leading-6 text-[#63706a]">Closed is final. The request cannot be reopened or receive further visible replies.</p>:<form action={updateSupportRequest} className="mt-4"><input type="hidden" name="requestId" value={request.id}/><label className="block text-sm font-bold">Set status<select name="status" defaultValue={request.status==="resolved"?"resolved":"in_progress"} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5"><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><button className="mt-3 w-full rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">Update status</button></form>}</section>

    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2"><FileLock2 size={18}/><h2 className="text-lg font-black">Internal admin notes</h2></div><p className="mt-2 text-sm leading-6 text-amber-950/70">Internal only. These notes are stored separately and are never included in the customer-visible thread.</p>{(notes??[]).length?<div className="mt-4 space-y-2">{(notes??[]).map(note=><article key={note.id} className="rounded-xl bg-white/80 p-3"><p className="whitespace-pre-wrap break-words text-sm leading-6">{note.note}</p><p className="mt-2 text-xs text-[#7a6d45]">{stamp(note.created_at)}</p></article>)}</div>:<p className="mt-4 text-sm text-amber-950/60">No internal notes yet.</p>}<form action={adminAddSupportRequestNote} className="mt-4"><input type="hidden" name="requestId" value={request.id}/><label className="block text-sm font-bold">Add internal note<textarea name="note" required maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5" placeholder="Only SecondPart admins can read this note."/></label><button className="mt-3 w-full rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white">Save internal note</button></form></section>
   </aside>
  </div>
 </main></>;
}