import Link from "next/link";
import { Flag,LifeBuoy,Rocket,Scale,Settings2,ShieldCheck,Wrench } from "lucide-react";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewGaragePartner,reviewSellerVerification,updateMarketplaceReport,updateSupportRequest } from "./actions";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export default async function ModerationPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 await requireAdmin("/admin/moderation");
 const verificationPage=pageNumber(first(params.verificationPage));
 const reportsPage=pageNumber(first(params.reportsPage));
 const supportPage=pageNumber(first(params.supportPage));
 const garagePage=pageNumber(first(params.garagePage));
 const pageSize=20;
 const supabase=await createSupabaseServerClient();
 const [verificationResult,reportsResult,supportResult,garageResult]=await Promise.all([
  supabase.from("seller_verification_requests").select("id,status,message,requested_at,legal_business_name,business_reference,reference_url,business_name_snapshot,seller_type_snapshot,business_kind_snapshot,location_snapshot,postcode_snapshot,sellers(id,business_name,slug,location,verified_at)",{count:"exact"}).eq("status","pending").order("requested_at").range((verificationPage-1)*pageSize,(verificationPage-1)*pageSize+pageSize),
  supabase.from("marketplace_reports").select("id,reason,details,status,created_at,parts(id,title,slug),sellers(id,business_name,slug)",{count:"exact"}).eq("status","open").order("created_at").range((reportsPage-1)*pageSize,(reportsPage-1)*pageSize+pageSize),
  supabase.from("support_requests").select("id,topic,message,status,created_at,profiles(display_name)",{count:"exact"}).in("status",["open","in_progress"]).order("created_at").range((supportPage-1)*pageSize,(supportPage-1)*pageSize+pageSize),
  supabase.from("garage_partners").select("id,business_name,slug,location,postcode,description,customer_supplied_parts,recycled_parts,mobile_fitting,status,created_at",{count:"exact"}).eq("status","pending").order("created_at").range((garagePage-1)*pageSize,(garagePage-1)*pageSize+pageSize)
 ]);
 const verificationRaw=verificationResult.data??[];
 const reportsRaw=reportsResult.data??[];
 const supportRaw=supportResult.data??[];
 const garageRaw=garageResult.data??[];
 const verificationHasMore=verificationRaw.length>pageSize;
 const reportsHasMore=reportsRaw.length>pageSize;
 const supportHasMore=supportRaw.length>pageSize;
 const garageHasMore=garageRaw.length>pageSize;
 const verification=verificationRaw.slice(0,pageSize);
 const reports=reportsRaw.slice(0,pageSize);
 const support=supportRaw.slice(0,pageSize);
 const garages=garageRaw.slice(0,pageSize);
 const verificationCount=verificationResult.count??verification.length;
 const reportsCount=reportsResult.count??reports.length;
 const supportCount=supportResult.count??support.length;
 const garageCount=garageResult.count??garages.length;
 const href=(key:"verificationPage"|"reportsPage"|"supportPage"|"garagePage",targetPage:number)=>{
  const next=new URLSearchParams();
  if(verificationPage>1)next.set("verificationPage",String(verificationPage));
  if(reportsPage>1)next.set("reportsPage",String(reportsPage));
  if(supportPage>1)next.set("supportPage",String(supportPage));
  if(garagePage>1)next.set("garagePage",String(garagePage));
  if(targetPage>1)next.set(key,String(targetPage));else next.delete(key);
  const qs=next.toString();
  return qs?"/admin/moderation?"+qs:"/admin/moderation";
 };
 return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Admin</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Marketplace moderation</h1><p className="mt-2 max-w-2xl text-[#63706a]">Launch moderation for seller verification, listing reports and support.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/founding-sellers" className="inline-flex w-fit items-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-black"><Rocket size={17}/>Founding Sellers</Link><Link href="/admin/commerce" className="inline-flex w-fit items-center gap-2 rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white"><Scale size={17}/>Commerce cases</Link><Link href="/admin/privacy" className="inline-flex w-fit items-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-black">Privacy requests</Link><Link href="/admin/system" className="inline-flex w-fit items-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-black"><Settings2 size={17}/>System readiness</Link></div></div>

  <section className="mt-10"><div className="flex items-center gap-2"><ShieldCheck size={20}/><h2 className="text-2xl font-black">Seller verification</h2><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{verificationCount}</span></div>
   {verification.length?<div className="mt-5 grid gap-4">{verification.map(row=>{const seller=Array.isArray(row.sellers)?row.sellers[0]:row.sellers;return <article key={row.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><h3 className="text-xl font-black">{seller?.business_name??"Seller"}</h3><p className="mt-1 text-sm text-[#63706a]">{seller?.location} · requested {new Date(row.requested_at).toLocaleDateString("en-GB")}</p><div className="mt-3 grid gap-1 rounded-2xl bg-[#f8f7f2] p-4 text-sm"><span><strong>Submitted legal name:</strong> {row.legal_business_name}</span><span><strong>Profile snapshot:</strong> {row.business_name_snapshot} · {row.business_kind_snapshot?.replaceAll("_"," ")??row.seller_type_snapshot} · {row.location_snapshot}{row.postcode_snapshot?" · "+row.postcode_snapshot:""}</span>{row.business_reference&&<span><strong>Business / licensing reference:</strong> {row.business_reference}</span>}{row.reference_url&&<span><strong>Public reference URL:</strong> {row.reference_url}</span>}</div>{row.message&&<p className="mt-3 max-w-3xl text-sm leading-6">{row.message}</p>}{seller?.slug&&<Link href={"/seller/"+seller.slug} className="mt-3 inline-block text-sm font-black underline">View public seller</Link>}</div><form action={reviewSellerVerification} className="min-w-0 lg:w-96"><input type="hidden" name="requestId" value={row.id}/><textarea name="note" rows={2} maxLength={500} className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm" placeholder="Review note (optional)"/><div className="mt-2 flex gap-2"><button name="decision" value="approve" className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">Approve</button><button name="decision" value="reject" className="flex-1 rounded-xl bg-red-800 px-4 py-2.5 text-sm font-black text-white">Reject</button></div></form></div></article>;})}</div>:<p className="mt-4 rounded-2xl border border-dashed border-black/20 p-6 text-[#63706a]">No pending verification requests.</p>}
   {(verificationPage>1||verificationHasMore)&&<nav aria-label="Seller verification pages" className="mt-6 flex items-center justify-center gap-3">{verificationPage>1&&<Link href={href("verificationPage",verificationPage-1)} className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {verificationPage}</span>{verificationHasMore&&<Link href={href("verificationPage",verificationPage+1)} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}
  </section>

  <section className="mt-12"><div className="flex items-center gap-2"><Wrench size={20}/><h2 className="text-2xl font-black">Garage partner applications</h2><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{garageCount}</span></div>
   {garages.length?<div className="mt-5 grid gap-4">{garages.map(row=><article key={row.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><h3 className="text-xl font-black">{row.business_name}</h3><p className="mt-1 text-sm text-[#63706a]">{row.location} · {row.postcode} · applied {new Date(row.created_at).toLocaleDateString("en-GB")}</p><p className="mt-3 max-w-3xl text-sm leading-6">{row.description}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#eef1eb] px-3 py-1">{row.customer_supplied_parts?"Accepts customer parts":"No customer parts"}</span><span className="rounded-full bg-[#eef1eb] px-3 py-1">{row.recycled_parts?"Fits recycled parts":"No recycled parts"}</span>{row.mobile_fitting&&<span className="rounded-full bg-[#eef1eb] px-3 py-1">Mobile fitting</span>}</div></div><form action={reviewGaragePartner} className="flex min-w-0 gap-2 lg:w-80"><input type="hidden" name="garageId" value={row.id}/><button name="decision" value="approve" className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">Approve</button><button name="decision" value="reject" className="flex-1 rounded-xl bg-red-800 px-4 py-2.5 text-sm font-black text-white">Reject</button></form></div></article>)}</div>:<p className="mt-4 rounded-2xl border border-dashed border-black/20 p-6 text-[#63706a]">No pending garage applications.</p>}
   {(garagePage>1||garageHasMore)&&<nav aria-label="Garage application pages" className="mt-6 flex items-center justify-center gap-3">{garagePage>1&&<Link href={href("garagePage",garagePage-1)} className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {garagePage}</span>{garageHasMore&&<Link href={href("garagePage",garagePage+1)} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}
  </section>

  <section className="mt-12"><div className="flex items-center gap-2"><Flag size={20}/><h2 className="text-2xl font-black">Open reports</h2><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{reportsCount}</span></div>
   {reports.length?<div className="mt-5 grid gap-4">{reports.map(row=>{const part=Array.isArray(row.parts)?row.parts[0]:row.parts;const seller=Array.isArray(row.sellers)?row.sellers[0]:row.sellers;return <article key={row.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-900">{row.reason.replaceAll("_"," ")}</span><h3 className="mt-3 text-xl font-black">{part?.title??seller?.business_name??"Marketplace report"}</h3><p className="mt-1 text-sm text-[#63706a]">{seller?.business_name&&"Seller: "+seller.business_name+" · "}Reported {new Date(row.created_at).toLocaleDateString("en-GB")}</p>{row.details&&<p className="mt-3 max-w-3xl text-sm leading-6">{row.details}</p>}{part?.slug&&<Link href={"/parts/"+part.slug} className="mt-3 inline-block text-sm font-black underline">View listing</Link>}</div><form action={updateMarketplaceReport} className="flex flex-wrap gap-2 lg:max-w-sm"><input type="hidden" name="reportId" value={row.id}/><button name="status" value="reviewed" className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">Mark reviewed</button><button name="status" value="dismissed" className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">Dismiss</button><button name="status" value="actioned" className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Actioned</button></form></div></article>;})}</div>:<p className="mt-4 rounded-2xl border border-dashed border-black/20 p-6 text-[#63706a]">No open marketplace reports.</p>}
   {(reportsPage>1||reportsHasMore)&&<nav aria-label="Marketplace report pages" className="mt-6 flex items-center justify-center gap-3">{reportsPage>1&&<Link href={href("reportsPage",reportsPage-1)} className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {reportsPage}</span>{reportsHasMore&&<Link href={href("reportsPage",reportsPage+1)} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}
  </section>
  <section className="mt-12"><div className="flex items-center gap-2"><LifeBuoy size={20}/><h2 className="text-2xl font-black">Support requests</h2><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{supportCount}</span></div>
   {support.length?<div className="mt-5 grid gap-4">{support.map(row=>{const profile=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;return <article key={row.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-black">{row.topic}</span><h3 className="mt-3 text-lg font-black">{profile?.display_name??"Account support"}</h3><p className="mt-1 text-xs text-[#8a918e]">{new Date(row.created_at).toLocaleString("en-GB")}</p><p className="mt-3 max-w-3xl text-sm leading-6">{row.message}</p></div><form action={updateSupportRequest} className="flex gap-2"><input type="hidden" name="requestId" value={row.id}/>{row.status==="open"&&<button name="status" value="in_progress" className="rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black">In progress</button>}<button name="status" value="closed" className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Close</button></form></div></article>;})}</div>:<p className="mt-4 rounded-2xl border border-dashed border-black/20 p-6 text-[#63706a]">No open support requests.</p>}
   {(supportPage>1||supportHasMore)&&<nav aria-label="Support request pages" className="mt-6 flex items-center justify-center gap-3">{supportPage>1&&<Link href={href("supportPage",supportPage-1)} className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {supportPage}</span>{supportHasMore&&<Link href={href("supportPage",supportPage+1)} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}
  </section>
 </main></>;
}
