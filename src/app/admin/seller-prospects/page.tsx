import Link from "next/link";
import { ArrowLeft,ExternalLink,Mail,Phone,Search,Target } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SellerProspectImport } from "@/components/seller-prospect-import";
import { updateSellerProspect } from "./actions";

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
 const {data,error,count}=await query.range((page-1)*pageSize,(page-1)*pageSize+pageSize);
 if(error)throw new Error("Seller prospect CRM is temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>pageSize;
 const items=raw.slice(0,pageSize);
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

  <div className="mt-7 grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><SellerProspectImport/><section className="rounded-3xl border border-black/10 bg-[#f4f7f2] p-5 sm:p-6"><h2 className="text-xl font-black">Research rules</h2><div className="mt-4 grid gap-3 text-sm leading-6 text-[#63706a]"><p><strong className="text-[#173c31]">Store provenance:</strong> use source_type plus source_url so every business record can be traced.</p><p><strong className="text-[#173c31]">Business contact data:</strong> prefer public business email/phone rather than personal contact details.</p><p><strong className="text-[#173c31]">Do not contact:</strong> terminal CRM status clears the next-action reminder.</p><p><strong className="text-[#173c31]">Priority A:</strong> strongest fit for launch inventory/liquidity; B is normal target; C is lower priority.</p></div></section></div>

  <form method="get" className="mt-7 grid gap-3 rounded-2xl border border-black/10 bg-white p-4 lg:grid-cols-[minmax(220px,1fr)_150px_150px_100px_auto_auto] lg:items-end">
   <label className="text-xs font-black">Search<input name="q" defaultValue={q} className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5" placeholder="Business, location, postcode, email"/></label>
   <label className="text-xs font-black">Status<select name="status" defaultValue={status} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5">{statuses.map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label>
   <label className="text-xs font-black">Business type<select name="kind" defaultValue={kind} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5">{kinds.map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label>
   <label className="text-xs font-black">Priority<select name="priority" defaultValue={priority} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5">{priorities.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
   <label className="flex min-h-11 items-center gap-2 rounded-xl bg-[#f8f7f2] px-3 text-xs font-black"><input name="due" value="1" type="checkbox" defaultChecked={due}/>Due now</label>
   <button className="min-h-11 rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white"><Search size={15} className="mr-1 inline"/>Filter</button>
  </form>

  {items.length?<div className="mt-6 grid gap-4">{items.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row">
   <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.priority==="A"?"bg-red-50 text-red-800":item.priority==="B"?"bg-amber-50 text-amber-900":"bg-[#eef1eb]"}`}>Priority {item.priority}</span><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black capitalize">{item.status.replaceAll("_"," ")}</span><span className="rounded-full bg-[#f4f7f2] px-2.5 py-1 text-xs font-black">{item.business_kind.replaceAll("_"," ")}</span><span className="text-xs font-bold text-[#63706a]">{item.source_type}</span></div><h2 className="mt-3 text-xl font-black">{item.business_name}</h2><p className="mt-1 text-sm font-bold text-[#63706a]">{[item.location,item.postcode].filter(Boolean).join(" · ")||"Location not captured"}</p><div className="mt-3 flex flex-wrap gap-3 text-sm">{item.public_email&&<a href={"mailto:"+item.public_email} className="inline-flex items-center gap-1 font-black underline"><Mail size={14}/>{item.public_email}</a>}{item.public_phone&&<a href={"tel:"+item.public_phone} className="inline-flex items-center gap-1 font-black underline"><Phone size={14}/>{item.public_phone}</a>}{item.website_url&&<a href={item.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black underline">Website <ExternalLink size={13}/></a>}{item.source_url&&<a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#287154] underline">Source <ExternalLink size={13}/></a>}</div><div className="mt-4 flex flex-wrap gap-4 text-xs text-[#63706a]"><span><strong>Est. inventory:</strong> {item.estimated_inventory??"—"}</span><span><strong>Last contacted:</strong> {item.last_contacted_at?new Date(item.last_contacted_at).toLocaleDateString("en-GB"):"—"}</span><span><strong>Next action:</strong> {item.next_action_at?new Date(item.next_action_at).toLocaleString("en-GB"):"—"}</span></div></div>
   <form action={updateSellerProspect} className="lg:w-[390px]"><input type="hidden" name="id" value={item.id}/><div className="grid grid-cols-2 gap-2"><label className="text-xs font-black">Status<select name="status" defaultValue={item.status} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2">{statuses.filter(value=>value!=="all").map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label><label className="text-xs font-black">Priority<select name="priority" defaultValue={item.priority} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2">{["A","B","C"].map(value=><option key={value}>{value}</option>)}</select></label></div><label className="mt-3 block text-xs font-black">Next action<input type="datetime-local" name="nextActionAt" defaultValue={item.next_action_at?new Date(item.next_action_at).toISOString().slice(0,16):""} className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2"/></label><label className="mt-3 block text-xs font-black">CRM notes<textarea name="notes" maxLength={2000} rows={3} defaultValue={item.notes??""} className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2" placeholder="Contact result, objection, next move…"/></label><button className="mt-3 w-full rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Save prospect</button></form>
  </div></article>)}</div>:<div className="mt-6 rounded-3xl border border-dashed border-black/20 p-8 text-center"><h2 className="text-xl font-black">No prospects match this view</h2><p className="mt-2 text-sm text-[#63706a]">Import research CSVs or change the filters.</p></div>}

  {(page>1||hasMore)&&<nav className="mt-8 flex justify-center gap-3">{page>1&&<Link href={href(page-1)} className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Previous</Link>}<span className="px-3 py-2.5 text-sm font-bold text-[#63706a]">Page {page}</span>{hasMore&&<Link href={href(page+1)} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}
 </main></>;
}
