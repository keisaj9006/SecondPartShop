import Link from "next/link";
import { ArrowLeft,Clock3,ExternalLink,History,Mail,Phone,Search,Target,Zap } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SellerProspectImport } from "@/components/seller-prospect-import";
import { CopyInviteLink } from "@/components/copy-invite-link";
import { ProspectOutreachPack } from "@/components/prospect-outreach-pack";
import { addSellerProspectActivity,createSellerProspectInvite,updateSellerProspect } from "./actions";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:1;};
const statuses=["all","research","ready","contacted","replied","qualified","invited","onboarding","onboarded","not_interested","do_not_contact"] as const;
const kinds=["all","breaker","atf","garage","parts_business","ebay_seller","other"] as const;
const priorities=["all","A","B","C"] as const;

export default async function SellerProspectsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin("/admin/seller-prospects");
 const params=await searchParams;
 const statusRaw=first(params.status)??"all";
 const kindRaw=first(params.kind)??"all";
 const priorityRaw=first(params.priority)??"all";
 const status=statuses.includes(statusRaw as (typeof statuses)[number])?statusRaw:"all";
 const kind=kinds.includes(kindRaw as (typeof kinds)[number])?kindRaw:"all";
 const priority=priorities.includes(priorityRaw as (typeof priorities)[number])?priorityRaw:"all";
 const q=(first(params.q)??"").trim().slice(0,120);
 const due=first(params.due)==="1";
 const page=pageNumber(first(params.page));
 const pageSize=30;
 const supabase=await createSupabaseServerClient();
 let query=supabase.from("seller_prospects")
  .select("id,business_name,business_kind,website_url,public_email,public_phone,location,postcode,source_type,source_url,estimated_inventory,priority,status,last_contacted_at,next_action_at,notes,created_at",{count:"exact"})
  .order("priority")
  .order("next_action_at",{ascending:true,nullsFirst:false})
  .order("created_at",{ascending:false});
 if(status!=="all")query=query.eq("status",status);
 if(kind!=="all")query=query.eq("business_kind",kind);
 if(priority!=="all")query=query.eq("priority",priority);
 if(due)query=query.lte("next_action_at",new Date().toISOString()).not("status","in","(onboarded,not_interested,do_not_contact)");
 if(q){
  const safe=q.replaceAll("%","\\%").replaceAll("_","\\_");
  query=query.or(`business_name.ilike.%${safe}%,location.ilike.%${safe}%,postcode.ilike.%${safe}%,public_email.ilike.%${safe}%`);
 }
 const [{data,error,count},{data:nextBest,error:nextBestError}]=await Promise.all([
  query.range((page-1)*pageSize,(page-1)*pageSize+pageSize),
  supabase.rpc("admin_next_best_seller_prospects",{p_limit:10})
 ]);
 if(error||nextBestError)throw new Error("Seller prospect CRM is temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>pageSize;
 const items=raw.slice(0,pageSize);
 const ids=items.map(item=>item.id);
 const {data:activityRows,error:activityError}=ids.length
  ?await supabase.from("seller_prospect_activities")
    .select("id,prospect_id,activity_type,outcome,note,next_action_at,created_at,profiles(display_name)")
    .in("prospect_id",ids)
    .order("created_at",{ascending:false})
    .limit(300)
  :{data:[],error:null};
 if(activityError)throw new Error("Seller prospect activity history is temporarily unavailable.");
 const {data:inviteRows,error:inviteError}=ids.length
  ?await supabase.from("seller_prospect_invites").select("prospect_id,token,expires_at,used_at").in("prospect_id",ids)
  :{data:[],error:null};
 if(inviteError)throw new Error("Seller prospect invites are temporarily unavailable.");
 const invitesByProspect=new Map((inviteRows??[]).map(invite=>[invite.prospect_id,invite] as const));
 type ActivityRow=NonNullable<typeof activityRows>[number];
 const activitiesByProspect=new Map<string,ActivityRow[]>();
 for(const activity of activityRows??[]){
  const list:ActivityRow[]=activitiesByProspect.get(activity.prospect_id)??[];
  if(list.length<5)list.push(activity);
  activitiesByProspect.set(activity.prospect_id,list);
 }
 const href=(targetPage=1)=>{
  const next=new URLSearchParams();
  if(status!=="all")next.set("status",status);
  if(kind!=="all")next.set("kind",kind);
  if(priority!=="all")next.set("priority",priority);
  if(q)next.set("q",q);
  if(due)next.set("due","1");
  if(targetPage>1)next.set("page",String(targetPage));
  const qs=next.toString();
  return "/admin/seller-prospects"+(qs?"?"+qs:"");
 };

 return <><Header/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href="/admin/founding-sellers" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={15}/>Founding Seller pipeline</Link><p className="mt-5 flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#287154]"><Target size={15}/>Outbound acquisition</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Seller prospect CRM</h1><p className="mt-2 max-w-2xl text-[#63706a]">Research base for UK breakers, ATFs, garages, parts businesses and eBay sellers. Keep source provenance and respect do-not-contact status.</p></div><div className="flex flex-wrap gap-2"><a href="/seller-prospect-import-template.csv" download className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Download research CSV</a><span className="rounded-full bg-[#eef1eb] px-4 py-2.5 text-sm font-black">{count??items.length} prospects</span></div></div>

  {(nextBest??[]).length>0&&<section className="mt-7 rounded-[30px] bg-[#173c31] p-5 text-white sm:p-6">
   <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#d4f44d]"><Zap size={15}/>Next Best Prospects</p><h2 className="mt-2 text-2xl font-black">Who to work next</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/65">Score combines pipeline warmth, due follow-ups, business type, estimated inventory, priority and available public business contact data.</p></div><Link href="/admin/seller-prospects?due=1" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black">Due follow-ups</Link></div>
   <div className="mt-5 grid gap-3 lg:grid-cols-2">{(nextBest??[]).map(item=><article key={item.id} className="rounded-2xl border border-white/10 bg-white/8 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2 text-[11px] font-black"><span className="rounded-full bg-[#d4f44d] px-2 py-1 text-[#173c31]">Score {item.score}</span><span className="rounded-full bg-white/10 px-2 py-1 capitalize">{item.status.replaceAll("_"," ")}</span><span className="rounded-full bg-white/10 px-2 py-1">Priority {item.priority}</span></div><h3 className="mt-3 text-lg font-black">{item.business_name}</h3><p className="mt-1 text-xs text-white/60">{[item.business_kind.replaceAll("_"," "),item.location,item.postcode].filter(Boolean).join(" · ")}</p></div>{item.next_action_at&&new Date(item.next_action_at)<=new Date()&&<span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 text-[11px] font-black text-red-100"><Clock3 size={12}/>Due</span>}</div><div className="mt-3 flex flex-wrap gap-1.5">{(item.score_reasons??[]).slice(0,4).map(reason=><span key={reason} className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/75">{reason}</span>)}</div><div className="mt-3 flex flex-wrap gap-3 text-xs">{item.public_email&&<a href={"mailto:"+item.public_email} className="font-black underline">Email</a>}{item.public_phone&&<a href={"tel:"+item.public_phone} className="font-black underline">Call</a>}<Link href={"/admin/seller-prospects?q="+encodeURIComponent(item.business_name)} className="font-black underline">Open CRM record</Link></div></article>)}</div>
  </section>}

  <div className="mt-7 grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><SellerProspectImport/><section className="rounded-3xl border border-black/10 bg-[#f4f7f2] p-5 sm:p-6"><h2 className="text-xl font-black">Research rules</h2><div className="mt-4 grid gap-3 text-sm leading-6 text-[#63706a]"><p><strong className="text-[#173c31]">Store provenance:</strong> use source_type plus source_url so every business record can be traced.</p><p><strong className="text-[#173c31]">Business contact data:</strong> prefer public business email/phone rather than personal contact details.</p><p><strong className="text-[#173c31]">Do not contact:</strong> terminal CRM status clears the next-action reminder.</p><p><strong className="text-[#173c31]">Priority A:</strong> strongest fit for launch inventory/liquidity; B is normal target; C is lower priority.</p></div></section></div>

  <form method="get" className="mt-7 grid gap-3 rounded-2xl border border-black/10 bg-white p-4 lg:grid-cols-[minmax(220px,1fr)_150px_150px_100px_auto_auto] lg:items-end">
   <label className="text-xs font-black">Search<input name="q" defaultValue={q} className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5" placeholder="Business, location, postcode, email"/></label>
   <label className="text-xs font-black">Status<select name="status" defaultValue={status} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5">{statuses.map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label>
   <label className="text-xs font-black">Business type<select name="kind" defaultValue={kind} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5">{kinds.map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label>
   <label className="text-xs font-black">Priority<select name="priority" defaultValue={priority} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5">{priorities.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
   <label className="flex min-h-11 items-center gap-2 rounded-xl bg-[#f8f7f2] px-3 text-xs font-black"><input name="due" value="1" type="checkbox" defaultChecked={due}/>Due now</label>
   <button className="min-h-11 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white"><Search size={15} className="mr-1 inline"/>Filter</button>
  </form>

  {items.length?<div className="mt-6 grid gap-4">{items.map(item=>{const history=activitiesByProspect.get(item.id)??[];const invite=invitesByProspect.get(item.id);return <article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row">
   <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.priority==="A"?"bg-red-50 text-red-800":item.priority==="B"?"bg-amber-50 text-amber-900":"bg-[#eef1eb]"}`}>Priority {item.priority}</span><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black capitalize">{item.status.replaceAll("_"," ")}</span><span className="rounded-full bg-[#f4f7f2] px-2.5 py-1 text-xs font-black">{item.business_kind.replaceAll("_"," ")}</span><span className="text-xs font-bold text-[#63706a]">{item.source_type}</span></div><h2 className="mt-3 text-xl font-black">{item.business_name}</h2><p className="mt-1 text-sm font-bold text-[#63706a]">{[item.location,item.postcode].filter(Boolean).join(" · ")||"Location not captured"}</p><div className="mt-3 flex flex-wrap gap-3 text-sm">{item.public_email&&<a href={"mailto:"+item.public_email} className="inline-flex items-center gap-1 font-black underline"><Mail size={14}/>{item.public_email}</a>}{item.public_phone&&<a href={"tel:"+item.public_phone} className="inline-flex items-center gap-1 font-black underline"><Phone size={14}/>{item.public_phone}</a>}{item.website_url&&<a href={item.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black underline">Website <ExternalLink size={13}/></a>}{item.source_url&&<a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#287154] underline">Source <ExternalLink size={13}/></a>}</div><div className="mt-4 flex flex-wrap gap-4 text-xs text-[#63706a]"><span><strong>Est. inventory:</strong> {item.estimated_inventory??"—"}</span><span><strong>Last contacted:</strong> {item.last_contacted_at?new Date(item.last_contacted_at).toLocaleDateString("en-GB"):"—"}</span><span><strong>Next action:</strong> {item.next_action_at?new Date(item.next_action_at).toLocaleString("en-GB"):"—"}</span></div></div>
   <form action={updateSellerProspect} className="lg:w-[390px]"><input type="hidden" name="id" value={item.id}/><div className="grid grid-cols-2 gap-2"><label className="text-xs font-black">Status<select name="status" defaultValue={item.status} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2">{statuses.filter(value=>value!=="all").map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label><label className="text-xs font-black">Priority<select name="priority" defaultValue={item.priority} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2">{["A","B","C"].map(value=><option key={value}>{value}</option>)}</select></label></div><label className="mt-3 block text-xs font-black">Next action<input type="datetime-local" name="nextActionAt" defaultValue={item.next_action_at?new Date(item.next_action_at).toISOString().slice(0,16):""} className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2"/></label><label className="mt-3 block text-xs font-black">CRM notes<textarea name="notes" maxLength={2000} rows={3} defaultValue={item.notes??""} className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2" placeholder="Contact result, objection, next move…"/></label><button className="mt-3 w-full rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Save prospect</button></form>
  </div>
   <div className="mt-5 grid gap-4 border-t border-black/8 pt-5 lg:grid-cols-[1fr_1fr]">
    <section><div className="flex items-center gap-2"><History size={15} className="text-[#287154]"/><h3 className="text-sm font-black">Recent activity</h3></div>{history.length?<div className="mt-3 grid gap-2">{history.map(activity=>{const profile=Array.isArray(activity.profiles)?activity.profiles[0]:activity.profiles;return <div key={activity.id} className="rounded-xl bg-[#f8f7f2] p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="capitalize">{activity.activity_type.replaceAll("_"," ")}</strong><span className="text-[#8a918e]">{new Date(activity.created_at).toLocaleString("en-GB")}</span></div>{activity.outcome&&<p className="mt-1 font-bold">{activity.outcome}</p>}{activity.note&&<p className="mt-1 leading-5 text-[#63706a]">{activity.note}</p>}<p className="mt-1 text-[10px] text-[#8a918e]">{profile?.display_name??"Admin"}{activity.next_action_at?" · next "+new Date(activity.next_action_at).toLocaleString("en-GB"):""}</p></div>;})}</div>:<p className="mt-3 text-xs text-[#63706a]">No activity logged yet.</p>}
    <div className="mt-4 rounded-xl border border-black/10 bg-white p-3"><p className="text-xs font-black">Founding Seller invite</p>{invite&&!invite.used_at&&new Date(invite.expires_at)>new Date()?<div className="mt-2 flex flex-wrap items-center gap-2"><CopyInviteLink path={"/founding-sellers?invite="+encodeURIComponent(invite.token)}/><Link href={"/founding-sellers?invite="+encodeURIComponent(invite.token)} target="_blank" className="text-xs font-black underline">Open</Link><span className="text-[10px] text-[#63706a]">Expires {new Date(invite.expires_at).toLocaleDateString("en-GB")}</span><form action={createSellerProspectInvite}><input type="hidden" name="prospectId" value={item.id}/><button className="text-xs font-black text-[#287154] underline">Refresh link</button></form></div><ProspectOutreachPack businessName={item.business_name} invitePath={"/founding-sellers?invite="+encodeURIComponent(invite.token)} publicEmail={item.public_email}/>:invite?.used_at?<p className="mt-2 text-xs font-bold text-emerald-800">Invite used · application attributed.</p>:<form action={createSellerProspectInvite} className="mt-2"><input type="hidden" name="prospectId" value={item.id}/><button className="rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white">Create 30-day invite link</button></form>}</div></section>
    <form action={addSellerProspectActivity} className="rounded-2xl bg-[#f4f7f2] p-4"><input type="hidden" name="prospectId" value={item.id}/><p className="text-sm font-black">Log activity</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs font-black">Type<select name="activityType" defaultValue="email" className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2"><option value="email">Email sent</option><option value="call">Call</option><option value="reply">Reply received</option><option value="meeting">Meeting</option><option value="invite">Invite sent</option><option value="research">Research</option><option value="note">Note</option></select></label><label className="text-xs font-black">Outcome<input name="outcome" maxLength={500} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2" placeholder="No answer / interested / asked for CSV…"/></label></div><label className="mt-2 block text-xs font-black">Activity note<textarea name="activityNote" maxLength={2000} rows={2} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2" placeholder="What happened and what matters next?"/></label><label className="mt-2 block text-xs font-black">Next action<input type="datetime-local" name="activityNextActionAt" className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2"/></label><button className="mt-3 w-full rounded-xl bg-[#287154] px-4 py-2.5 text-xs font-black text-white">Save activity</button></form>
   </div>
  </article>})}</div>:<div className="mt-6 rounded-3xl border border-dashed border-black/20 p-8 text-center"><h2 className="text-xl font-black">No prospects match this view</h2><p className="mt-2 text-sm text-[#63706a]">Import research CSVs or change the filters.</p></div>}

  {(page>1||hasMore)&&<nav className="mt-8 flex justify-center gap-3">{page>1&&<Link href={href(page-1)} className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Previous</Link>}<span className="px-3 py-2.5 text-sm font-bold text-[#63706a]">Page {page}</span>{hasMore&&<Link href={href(page+1)} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}
 </main></>;
}
