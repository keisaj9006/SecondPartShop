import Link from "next/link";
import { ArrowLeft,CheckCircle2,FileWarning,Layers3 } from "lucide-react";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { getInventoryImportReport } from "@/lib/data/inventory-imports";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";

export default async function InventoryImportReportPage({params}:{params:Promise<{id:string}>}){
 const [{user},{id}]=await Promise.all([requireSeller("/dashboard/import"),params]);
 if(!isUuid(id))notFound();
 const seller=await getSellerForOwner(user.id);
 if(!seller)notFound();
 const report=await getInventoryImportReport(seller.id,id);
 if(!report)notFound();

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
