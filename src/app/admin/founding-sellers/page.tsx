import Link from "next/link";
import { ArrowLeft,ExternalLink,Mail,Phone,Rocket } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateFoundingSellerApplication } from "./actions";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};
const statuses=["all","new","contacted","qualified","invited","onboarding","activated","rejected"] as const;
type StatusFilter=(typeof statuses)[number];

export default async function FoundingSellerAdminPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin("/admin/founding-sellers");
 const params=await searchParams;
 const requested=first(params.status)??"all";
 const status=(statuses.includes(requested as StatusFilter)?requested:"all") as StatusFilter;
 const page=pageNumber(first(params.page));
 const pageSize=30;
 const supabase=await createSupabaseServerClient();
 let query=supabase.from("founding_seller_applications")
  .select("id,contact_name,email,phone,business_name,business_kind,postcode,website_url,existing_channels,estimated_active_parts,import_interest,notes,source,status,admin_note,created_at",{count:"exact"})
  .order("created_at",{ascending:false})
  .order("id",{ascending:false});
 if(status!=="all")query=query.eq("status",status);
 const {data,error,count}=await query.range((page-1)*pageSize,(page-1)*pageSize+pageSize);
 if(error)throw new Error("Founding Seller applications are temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>pageSize;
 const items=raw.slice(0,pageSize);
 const filterHref=(value:StatusFilter)=>value==="all"?"/admin/founding-sellers":"/admin/founding-sellers?status="+value;
 const pageHref=(target:number)=>{
  const next=new URLSearchParams();
  if(status!=="all")next.set("status",status);
  if(target>1)next.set("page",String(target));
  const qs=next.toString();
  return "/admin/founding-sellers"+(qs?"?"+qs:"");
 };

 return <><Header/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
  <Link href="/admin/moderation" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={15}/>Marketplace moderation</Link>
  <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#287154]"><Rocket size={15}/>Acquisition CRM</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Founding Seller pipeline</h1><p className="mt-2 text-[#63706a]">Applications from breakers, ATFs, garages and parts businesses before account activation.</p></div><span className="rounded-full bg-[#eef1eb] px-3 py-1.5 text-sm font-black">{count??items.length} lead{(count??items.length)===1?"":"s"}</span></div>
  <nav className="mt-6 flex flex-wrap gap-2">{statuses.map(value=><Link key={value} href={filterHref(value)} className={`rounded-full px-3 py-2 text-xs font-black capitalize ${status===value?"bg-[#173c31] text-white":"border border-black/15 bg-white"}`}>{value.replaceAll("_"," ")}</Link>)}</nav>

  {items.length?<div className="mt-6 grid gap-4">{items.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex flex-col justify-between gap-5 lg:flex-row">
    <div className="min-w-0 flex-1">
     <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black capitalize">{item.status}</span><span className="rounded-full bg-[#f4f7f2] px-2.5 py-1 text-xs font-black">{item.business_kind.replaceAll("_"," ")}</span><span className="text-xs font-bold text-[#63706a]">source: {item.source}</span></div>
     <h2 className="mt-3 text-xl font-black">{item.business_name}</h2>
     <p className="mt-1 text-sm font-bold">{item.contact_name} · {item.postcode}</p>
     <div className="mt-3 flex flex-wrap gap-3 text-sm"><a href={"mailto:"+item.email} className="inline-flex items-center gap-1 font-black underline"><Mail size={14}/>{item.email}</a>{item.phone&&<a href={"tel:"+item.phone} className="inline-flex items-center gap-1 font-black underline"><Phone size={14}/>{item.phone}</a>}{item.website_url&&<a href={item.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black underline">Website <ExternalLink size={13}/></a>}</div>
     <div className="mt-4 grid gap-2 rounded-2xl bg-[#f8f7f2] p-4 text-sm sm:grid-cols-2"><p><strong>Estimated inventory:</strong> {item.estimated_active_parts??"Not supplied"}</p><p><strong>Import interest:</strong> {item.import_interest.replaceAll("_"," ")}</p><p className="sm:col-span-2"><strong>Current channels:</strong> {item.existing_channels.length?item.existing_channels.join(", ").replaceAll("_"," "):"Not supplied"}</p></div>
     {item.notes&&<p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-[#63706a]">{item.notes}</p>}
     <p className="mt-3 text-xs text-[#8a918e]">Applied {new Date(item.created_at).toLocaleString("en-GB")}</p>
    </div>
    <form action={updateFoundingSellerApplication} className="lg:w-[360px]"><input type="hidden" name="id" value={item.id}/><label className="text-xs font-black">Pipeline status<select name="status" defaultValue={item.status} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5">{statuses.filter(value=>value!=="all").map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label><label className="mt-3 block text-xs font-black">Admin note<textarea name="adminNote" maxLength={2000} rows={4} defaultValue={item.admin_note??""} className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5" placeholder="Call outcome, objections, next action…"/></label><button className="mt-3 w-full rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Save pipeline update</button>{["qualified","invited","onboarding"].includes(item.status)&&<Link href="/account?mode=signup&role=seller&returnTo=/dashboard" className="mt-2 block text-center text-xs font-black underline">Open seller signup flow</Link>}</form>
   </div>
  </article>)}</div>:<div className="mt-6 rounded-3xl border border-dashed border-black/20 p-8 text-center"><h2 className="text-xl font-black">No applications in this view</h2><p className="mt-2 text-sm text-[#63706a]">Use another pipeline filter or start outreach with the Founding Seller application link.</p></div>}

  {(page>1||hasMore)&&<nav className="mt-8 flex items-center justify-center gap-3">{page>1&&<Link href={pageHref(page-1)} className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {page}</span>{hasMore&&<Link href={pageHref(page+1)} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}
 </main></>;
}
