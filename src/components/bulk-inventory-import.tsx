"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle,CheckCircle2,FileSpreadsheet,Upload } from "lucide-react";
import { bulkImportCsv,type BulkImportState } from "@/app/dashboard/import/actions";

const initial:BulkImportState={status:"idle"};

export function BulkInventoryImport(){
 const [state,action,pending]=useActionState(bulkImportCsv,initial);

 return <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
  <form action={action} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-start gap-3">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><Upload size={20}/></span>
    <div><h2 className="text-xl font-black">Upload inventory CSV</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">Up to 500 rows. Every imported part is created as a draft — CSV can never publish directly to the marketplace.</p></div>
   </div>

   <label className="mt-5 block text-sm font-black">CSV file
    <input required type="file" name="file" accept=".csv,text/csv" className="mt-2 block w-full rounded-xl border border-black/15 bg-[#f8f7f2] p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#173c31] file:px-4 file:py-2 file:font-black file:text-white"/>
   </label>
   <p className="mt-2 text-xs leading-5 text-[#63706a]">Maximum 2 MB. Preview is recommended before importing. If the browser clears the selected file after preview, choose the same file again before importing.</p>

   <div className="mt-5 grid gap-2 sm:grid-cols-2">
    <button name="mode" value="preview" disabled={pending} className="min-h-12 rounded-xl border border-[#173c31] bg-white px-5 py-3 text-sm font-black text-[#173c31] disabled:opacity-50">{pending?"Checking…":"Preview CSV"}</button>
    <button name="mode" value="import" disabled={pending} className="min-h-12 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{pending?"Working…":"Import valid rows as drafts"}</button>
   </div>

   {state.message&&<div role="status" className={"mt-5 rounded-2xl p-4 text-sm font-bold "+(state.status==="success"?"bg-emerald-50 text-emerald-900":state.status==="error"?"bg-red-50 text-red-900":"bg-cyan-50 text-cyan-950")}>{state.message}</div>}

   {state.rowsReceived!==undefined&&<div className="mt-4 grid grid-cols-3 gap-2">
    <div className="rounded-xl bg-[#f8f7f2] p-3"><p className="text-xs text-[#63706a]">Rows</p><p className="mt-1 text-xl font-black">{state.rowsReceived}</p></div>
    <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Valid / created</p><p className="mt-1 text-xl font-black text-emerald-900">{state.validRows??0}</p></div>
    <div className="rounded-xl bg-red-50 p-3"><p className="text-xs text-red-800">Rejected</p><p className="mt-1 text-xl font-black text-red-900">{state.rejectedRows??0}</p></div>
   </div>}

   {state.status==="success"&&<Link href="/dashboard?inventoryStatus=draft" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#d4f44d] px-5 py-2.5 text-sm font-black text-[#173c31]">Review imported drafts</Link>}
  </form>

  <aside className="rounded-3xl border border-black/10 bg-[#f4f7f2] p-5 sm:p-6">
   <div className="flex items-center gap-2"><FileSpreadsheet size={20} className="text-[#287154]"/><h2 className="text-xl font-black">Validation result</h2></div>
   {!state.sample?.length&&!state.issues?.length&&<p className="mt-4 text-sm leading-6 text-[#63706a]">Upload a file and choose Preview CSV. SecondPart will check categories, prices, donor registrations, seller references and technical rules before any row is created.</p>}
   {state.sample?.length?<>
    <p className="mt-4 text-xs font-black uppercase tracking-[.12em] text-[#63706a]">First rows</p>
    <div className="mt-2 grid gap-2">{state.sample.map(item=><div key={item.row} className="rounded-xl bg-white p-3 text-sm"><div className="flex items-center justify-between gap-2"><strong className="truncate">{item.title}</strong><span className="shrink-0 text-xs text-[#63706a]">row {item.row}</span></div><p className="mt-1 truncate text-xs text-[#63706a]">{item.category} · £{item.priceGbp||"?"}{item.sellerReference?" · ref "+item.sellerReference:""}</p></div>)}</div>
   </>:null}
   {state.issues?.length?<>
    <p className="mt-5 flex items-center gap-2 text-sm font-black text-red-800"><AlertTriangle size={17}/>Issues to fix</p>
    <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">{state.issues.map((issue,index)=><div key={issue.row+"-"+index} className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-900"><strong>Row {issue.row}:</strong> {issue.message}</div>)}</div>
   </>:state.status==="preview"||state.status==="success"?<p className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900"><CheckCircle2 size={17}/>No validation issues in the rows shown.</p>:null}
  </aside>
 </div>;
}
