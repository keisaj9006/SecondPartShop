"use client";

import { useActionState } from "react";
import { AlertTriangle,CheckCircle2,Upload } from "lucide-react";
import { importSellerProspects,type ProspectImportState } from "@/app/admin/seller-prospects/actions";

const initial:ProspectImportState={status:"idle"};

export function SellerProspectImport(){
 const [state,action,pending]=useActionState(importSellerProspects,initial);
 return <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
  <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><Upload size={19}/></span><div><h2 className="text-xl font-black">Import prospect research</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">Admin-only CSV import for public business prospect data. Preview checks duplicates and field formats before writing.</p></div></div>
  <form action={action} className="mt-5"><input required type="file" name="file" accept=".csv,text/csv" className="block w-full rounded-xl border border-black/15 bg-[#f8f7f2] p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#173c31] file:px-4 file:py-2 file:font-black file:text-white"/><div className="mt-3 grid gap-2 sm:grid-cols-2"><button disabled={pending} name="mode" value="preview" className="rounded-xl border border-[#173c31] px-4 py-3 text-sm font-black">Preview research CSV</button><button disabled={pending} name="mode" value="import" className="rounded-xl bg-[#173c31] px-4 py-3 text-sm font-black text-white">Import new prospects</button></div></form>
  {state.message&&<div className={`mt-4 rounded-xl p-3 text-sm font-bold ${state.status==="error"?"bg-red-50 text-red-800":state.status==="success"?"bg-emerald-50 text-emerald-900":"bg-cyan-50 text-cyan-950"}`}>{state.message}</div>}
  {state.rowsReceived!==undefined&&<div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#f8f7f2] p-3"><p className="text-xs text-[#63706a]">Rows</p><p className="text-xl font-black">{state.rowsReceived}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">New / created</p><p className="text-xl font-black text-emerald-950">{state.validRows??0}</p></div><div className="rounded-xl bg-red-50 p-3"><p className="text-xs text-red-800">Rejected / existing</p><p className="text-xl font-black text-red-950">{state.rejectedRows??0}</p></div></div>}
  {state.sample?.length?<div className="mt-4 grid gap-2 sm:grid-cols-2">{state.sample.map(item=><div key={item.row} className="rounded-xl bg-[#f8f7f2] p-3 text-xs"><strong>{item.businessName}</strong><p className="mt-1 text-[#63706a]">{item.businessKind} · {item.postcode||"no postcode"} · {item.sourceType}</p></div>)}</div>:null}
  {state.issues?.length?<details className="mt-4"><summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-amber-800"><AlertTriangle size={16}/>Import issues ({state.issues.length})</summary><div className="mt-2 max-h-72 space-y-2 overflow-y-auto">{state.issues.map((issue,index)=><div key={index} className="rounded-xl bg-amber-50 p-3 text-xs text-amber-950">{issue.row>0&&<strong>Row {issue.row}: </strong>}{issue.message}</div>)}</div></details>:state.status==="preview"||state.status==="success"?<p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 size={16}/>No additional validation issues.</p>:null}
 </section>;
}
