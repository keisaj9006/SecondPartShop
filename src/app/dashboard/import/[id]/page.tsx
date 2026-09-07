import Link from "next/link";
import { ArrowLeft,Boxes,CheckCircle2,FileWarning,ImageIcon,Layers3,ShieldCheck,Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { getInventoryImportReadiness,getInventoryImportReport,getInventoryImportWorkQueue,type InventoryImportNeed } from "@/lib/data/inventory-imports";
import { publishReadyImportDrafts } from "../actions";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};
const needs:InventoryImportNeed[]=["all","ready","photos","compatibility","technical","stock"];
const needLabel:Record<InventoryImportNeed,string>={
 all:"All drafts",
 ready:"Ready",
 photos:"Needs photos",
 compatibility:"Needs fit evidence",
 technical:"Needs technical",
 stock:"Needs stock"
};

export default async function InventoryImportReportPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{user},{id},query]=await Promise.all([requireSeller("/dashboard/import"),params,searchParams]);
 if(!isUuid(id))notFound();
 const seller=await getSellerForOwner(user.id);
 if(!seller)notFound();
 const requestedNeed=first(query.need)??"all";
 const need=(needs.includes(requestedNeed as InventoryImportNeed)?requestedNeed:"all") as InventoryImportNeed;
 const queuePage=pageNumber(first(query.queuePage));
 const queuePageSize=25;
 const queueOffset=(queuePage-1)*queuePageSize;
 const [report,readiness,queue]=await Promise.all([
  getInventoryImportReport(seller.id,id),
  getInventoryImportReadiness(id),
  getInventoryImportWorkQueue(id,need,queueOffset,queuePageSize)
 ]);
 if(!report)notFound();
 const published=Number(first(query.published)??0);
 const queueHref=(targetNeed:InventoryImportNeed,targetPage=1)=>{
  const params=new URLSearchParams();
  if(targetNeed!=="all")params.set("need",targetNeed);
  if(targetPage>1)params.set("queuePage",String(targetPage));
  const qs=params.toString();
  return "/dashboard/import/"+id+(qs?"?"+qs:"");
 };
 const needCount=(value:InventoryImportNeed)=>value==="all"?readiness.totalDrafts:value==="ready"?readiness.readyDrafts:value==="photos"?readiness.needsPhotos:value==="compatibility"?readiness.needsCompatibility:value==="technical"?readiness.needsTechnical:readiness.needsStock;

 const tone=report.status==="completed"
  ?"bg-emerald-50 text-emerald-900 border-emerald-200"
  :report.status==="partial"
   ?"bg-amber-50 text-amber-900 border-amber-200"
   :"bg-red-50 text-red-900 border-red-200";

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
  <Link href="/dashboard/import" className="inline-flex items-center gap-2 text-sm font-black text-[#173c31]"><ArrowLeft size={16}/>Bulk CSV Import</Link>
  <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#287154]">Import report</p><h1 className="mt-2 break-words text-3xl font-black tracking-[-.045em] sm:text-4xl">{report.filename||"CSV import"}</h1><p className="mt-2 text-sm text-[#63706a]">{new Date(report.createdAt).toLocaleString("en-GB")}</p></div>
   <span className={"w-fit rounded-full border px-3 py-1.5 text-xs font-black capitalize "+tone}>{report.status}</span>
  </div>

  <div className="mt-7 grid gap-3 sm:grid-cols-3">
   <div className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-black uppercase tracking-wide text-[#63706a]">Rows received</p><p className="mt-2 text-3xl font-black">{report.rowsReceived}</p></div>
   <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-emerald-800">Drafts created</p><p className="mt-2 text-3xl font-black text-emerald-950">{report.rowsCreated}</p></div>
   <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-red-800">Rows rejected</p><p className="mt-2 text-3xl font-black text-red-950">{report.rowsRejected}</p></div>
  </div>

  {published>0&&<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">{published} ready draft{published===1?"":"s"} published successfully. Drafts that still need evidence were left untouched.</div>}

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
    <div><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-[#287154]"/><h2 className="text-xl font-black">Publication readiness</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">SecondPart checks every remaining draft in this import. Bulk publishing can only activate listings with stock available, a real product photo and enough compatibility evidence.</p></div>
    {readiness.readyDrafts>0&&<form action={publishReadyImportDrafts}><input type="hidden" name="batchId" value={report.id}/><button className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Publish {readiness.readyDrafts} ready draft{readiness.readyDrafts===1?"":"s"}</button></form>}
   </div>
   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <div className="rounded-2xl bg-emerald-50 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-800"><CheckCircle2 size={15}/>Ready now</p><p className="mt-2 text-3xl font-black text-emerald-950">{readiness.readyDrafts}</p></div>
    <div className="rounded-2xl bg-[#f8f7f2] p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#63706a]"><Boxes size={15}/>Need stock</p><p className="mt-2 text-3xl font-black">{readiness.needsStock}</p></div>
    <div className="rounded-2xl bg-[#f8f7f2] p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#63706a]"><ImageIcon size={15}/>Need photos</p><p className="mt-2 text-3xl font-black">{readiness.needsPhotos}</p></div>
    <div className="rounded-2xl bg-[#f8f7f2] p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#63706a]"><ShieldCheck size={15}/>Need fit evidence</p><p className="mt-2 text-3xl font-black">{readiness.needsCompatibility}</p></div>
    <div className="rounded-2xl bg-[#f8f7f2] p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#63706a]"><Wrench size={15}/>Need technical data</p><p className="mt-2 text-3xl font-black">{readiness.needsTechnical}</p></div>
   </div>
   <p className="mt-4 text-xs leading-5 text-[#63706a]">{readiness.totalDrafts} draft{readiness.totalDrafts===1?" remains":"s remain"} in this batch. Missing requirements can overlap, so one listing may appear in more than one “needs” count.</p>
  </section>

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Import work queue</p><h2 className="mt-1 text-2xl font-black">Fix drafts by task</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Work through one requirement at a time. A draft can appear in more than one queue until every publication requirement is satisfied.</p></div><span className="rounded-full bg-[#eef1eb] px-3 py-1.5 text-xs font-black">{queue.total} in this queue</span></div>
   <nav className="mt-5 flex flex-wrap gap-2" aria-label="Import work queue filters">{needs.map(value=><Link key={value} href={queueHref(value)} className={`rounded-full px-3 py-2 text-xs font-black ${need===value?"bg-[#173c31] text-white":"border border-black/15 bg-white text-[#173c31]"}`}>{needLabel[value]} · {needCount(value)}</Link>)}</nav>
   {queue.items.length?<div className="mt-5 overflow-hidden rounded-2xl border border-black/10">
    <div className="hidden grid-cols-[minmax(0,1fr)_120px_210px_90px] gap-3 border-b border-black/10 bg-[#f8f7f2] px-4 py-3 text-xs font-black uppercase text-[#63706a] md:grid"><span>Listing</span><span>Reference</span><span>Requirements</span><span>Action</span></div>
    {queue.items.map(item=><div key={item.partId} className="grid gap-3 border-b border-black/8 p-4 last:border-0 md:grid-cols-[minmax(0,1fr)_120px_210px_90px] md:items-center">
     <div><p className="font-black">{item.title}</p><p className="mt-1 text-xs text-[#63706a]">{item.categoryName}</p></div>
     <p className="break-all text-xs font-bold text-[#63706a]">{item.sellerReference??"—"}</p>
     <div className="flex flex-wrap gap-1.5 text-[11px] font-black">
      <span className={`rounded-full px-2 py-1 ${item.hasStock?"bg-emerald-50 text-emerald-800":"bg-red-50 text-red-800"}`}>{item.hasStock?"Stock ✓":"Stock"}</span>
      <span className={`rounded-full px-2 py-1 ${item.hasPhoto?"bg-emerald-50 text-emerald-800":"bg-red-50 text-red-800"}`}>{item.hasPhoto?"Photo ✓":"Photo"}</span>
      <span className={`rounded-full px-2 py-1 ${item.hasCompatibility?"bg-emerald-50 text-emerald-800":"bg-red-50 text-red-800"}`}>{item.hasCompatibility?"Fit evidence ✓":"Fit evidence"}</span>
      <span className={`rounded-full px-2 py-1 ${item.hasTechnical?"bg-emerald-50 text-emerald-800":"bg-red-50 text-red-800"}`}>{item.hasTechnical?"Technical ✓":"Technical"}</span>
     </div>
     <Link href={"/dashboard/listings/"+item.partId+"/edit"} className="w-fit rounded-lg bg-[#173c31] px-3 py-2 text-xs font-black text-white">Fix listing</Link>
    </div>)}
   </div>:<div className="mt-5 rounded-2xl border border-dashed border-black/20 p-6 text-center"><p className="font-black">No drafts in this queue</p><p className="mt-1 text-sm text-[#63706a]">{need==="ready"?"No remaining draft is fully ready yet, or ready drafts have already been published.":"This requirement is clear for every remaining draft in the batch."}</p></div>}
   {(queuePage>1||queue.hasMore)&&<nav aria-label="Import work queue pages" className="mt-5 flex items-center justify-center gap-3">{queuePage>1&&<Link href={queueHref(need,queuePage-1)} className="rounded-full border border-black/15 px-4 py-2 text-xs font-black">Previous</Link>}<span className="text-xs font-bold text-[#63706a]">Queue page {queuePage}</span>{queue.hasMore&&<Link href={queueHref(need,queuePage+1)} className="rounded-full bg-[#173c31] px-4 py-2 text-xs font-black text-white">Next</Link>}</nav>}
  </section>

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-center gap-2"><Layers3 size={20} className="text-[#287154]"/><h2 className="text-xl font-black">What happened</h2></div>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">Imported listings were created as drafts only. Review photos, Part Passport evidence and compatibility before publishing.</p>
   {report.rowsCreated>0&&<div className="mt-5 flex flex-wrap gap-2"><Link href={"/dashboard?inventoryStatus=draft&importBatch="+report.id} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Review imported drafts</Link><Link href="/dashboard/import" className="rounded-full border border-black/15 px-5 py-3 text-sm font-black">Import another CSV</Link></div>}
  </section>

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-center gap-2">{report.issues.length?<FileWarning size={20} className="text-amber-700"/>:<CheckCircle2 size={20} className="text-emerald-700"/>}<h2 className="text-xl font-black">{report.issues.length?"Rejected row details":"No saved import issues"}</h2></div>
   {report.issues.length?<div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">{report.issues.map((issue,index)=><div key={issue.row+"-"+index} className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950"><strong>Row {issue.row}:</strong> {issue.message}</div>)}</div>:<p className="mt-3 text-sm text-[#63706a]">Every valid row in this batch was accepted by the importer.</p>}
  </section>
 </main></>;
}
