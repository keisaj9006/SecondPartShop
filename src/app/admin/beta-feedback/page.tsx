import Link from "next/link";
import { AlertTriangle,ArrowLeft,Bug,Lightbulb } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateSupportRequest } from "@/app/admin/moderation/actions";

export const dynamic="force-dynamic";

const BETA_PREFIX="[BETA_FEEDBACK v1]";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};
const field=(message:string,label:string)=>message.split("\n").find(line=>line.startsWith(label+":"))?.slice(label.length+1).trim()||"—";

export default async function BetaFeedbackAdminPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin("/admin/beta-feedback");
 const params=await searchParams;
 const page=pageNumber(first(params.page));
 const pageSize=20;
 const start=(page-1)*pageSize;
 const supabase=await createSupabaseServerClient();
 const {data,count,error}=await supabase
  .from("support_requests")
  .select("id,message,status,created_at,profiles(display_name,handle)",{count:"exact"})
  .eq("topic","other")
  .like("message",BETA_PREFIX+"%")
  .in("status",["open","in_progress"])
  .order("created_at",{ascending:true})
  .range(start,start+pageSize);
 if(error)throw error;
 const raw=data??[];
 const hasMore=raw.length>pageSize;
 const rows=raw.slice(0,pageSize);
 const total=count??rows.length;

 return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><div className="flex items-center gap-2 text-[#287154]"><Bug size={18}/><span className="text-xs font-black uppercase tracking-[.2em]">Admin · Closed Beta</span></div><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Beta feedback queue</h1><p className="mt-2 max-w-2xl text-[#63706a]">Open and in-progress reports submitted from the structured Closed Beta form. Blockers should be triaged before lower-severity feedback.</p></div>
   <Link href="/admin/moderation" className="inline-flex w-fit items-center gap-2 rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black"><ArrowLeft size={17}/>All moderation</Link>
  </div>

  <div className="mt-8 flex flex-wrap gap-2 text-sm font-bold"><span className="rounded-full bg-[#eef1eb] px-3 py-1.5">{total} open / in progress</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">Oldest first</span></div>

  {rows.length?<section className="mt-6 grid gap-4">{rows.map(row=>{
   const profile=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;
   const severity=field(row.message,"Severity");
   const category=field(row.message,"Category");
   const summary=field(row.message,"Summary");
   const blocker=severity==="blocker";
   return <article key={row.id} className={`rounded-3xl border bg-white p-5 sm:p-6 ${blocker?"border-red-300":"border-black/10"}`}>
    <div className="flex flex-col justify-between gap-5 lg:flex-row">
     <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${blocker?"bg-red-50 text-red-800":"bg-[#eef1eb] text-[#173c31]"}`}>{blocker?<AlertTriangle size={13}/>:<Lightbulb size={13}/>} {severity}</span><span className="rounded-full bg-[#eef8f3] px-2.5 py-1 text-xs font-black text-[#287154]">{category}</span><span className="rounded-full border border-black/10 px-2.5 py-1 text-xs font-bold">{row.status.replaceAll("_"," ")}</span></div>
      <h2 className="mt-3 text-xl font-black">{summary}</h2>
      <p className="mt-1 text-sm text-[#63706a]">{profile?.display_name??"Tester"}{profile?.handle?` · @${profile.handle}`:""} · submitted {new Date(row.created_at).toLocaleString("en-GB")}</p>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-2xl bg-[#f8f7f2] p-4 font-sans text-sm leading-6 text-[#38443f]">{row.message}</pre>
     </div>
     <form action={updateSupportRequest} className="flex shrink-0 gap-2 lg:w-64 lg:flex-col"><input type="hidden" name="requestId" value={row.id}/><button name="status" value="in_progress" className="flex-1 rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">Mark in progress</button><button name="status" value="closed" className="flex-1 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Close</button></form>
    </div>
   </article>;
  })}</section>:<div className="mt-6 rounded-3xl border border-dashed border-black/20 bg-white p-10 text-center"><Bug className="mx-auto text-[#287154]"/><h2 className="mt-3 text-xl font-black">No open beta feedback</h2><p className="mt-2 text-sm text-[#63706a]">New reports submitted from /beta-feedback will appear here automatically.</p></div>}

  {(page>1||hasMore)&&<nav aria-label="Beta feedback pages" className="mt-6 flex items-center justify-center gap-3">{page>1&&<Link href={page===2?"/admin/beta-feedback":`/admin/beta-feedback?page=${page-1}`} className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {page}</span>{hasMore&&<Link href={`/admin/beta-feedback?page=${page+1}`} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}
 </main></>;
}
