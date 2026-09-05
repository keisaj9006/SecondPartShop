import Link from "next/link";
import { CheckCircle2,Clock3,Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { getPartRequests } from "@/lib/data/part-requests";
import { closePartRequest,deletePartRequest } from "./actions";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function RequestsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [user,params]=await Promise.all([requireUser("/requests"),searchParams]);
 const requests=await getPartRequests(user.id);
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-black tracking-[-.045em]">Part requests</h1><p className="mt-2 max-w-2xl text-[#63706a]">Requests capture parts you could not find in the current marketplace. Seller response tools will be added later; this list keeps your demand organised now.</p></div><Link href="/#marketplace" className="w-fit rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Find or request a part</Link></div>
  {first(params.created)==="1"&&<div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Request saved. It is now in your account.</div>}
  {requests.length?<div className="mt-8 grid gap-4">{requests.map(request=><article key={request.id} className="rounded-3xl border border-black/10 bg-white p-5">
   <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2">{request.status==="open"?<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-900"><Clock3 size={13}/>Open</span>:<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-900"><CheckCircle2 size={13}/>Closed</span>}{request.categoryName&&<span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-xs font-bold">{request.categoryName}</span>}</div><h2 className="mt-3 text-xl font-black">{request.queryText}</h2>{request.oemNumber&&<p className="mt-1 text-sm text-[#63706a]">OE/OEM: <strong>{request.oemNumber}</strong></p>}{request.vehicleLabel&&<p className="mt-2 text-sm font-bold">{request.registration&&<span className="mr-1 font-mono">{request.registration} ·</span>}{request.vehicleLabel}</p>}{request.notes&&<p className="mt-3 max-w-2xl text-sm leading-6 text-[#63706a]">{request.notes}</p>}<p className="mt-3 text-xs text-[#8a918e]">Created {new Date(request.createdAt).toLocaleDateString("en-GB")}</p></div><div className="flex gap-2">{request.status==="open"&&<form action={closePartRequest}><input type="hidden" name="id" value={request.id}/><button className="rounded-xl border border-black/10 px-3 py-2 text-xs font-black">Mark closed</button></form>}<form action={deletePartRequest}><input type="hidden" name="id" value={request.id}/><button aria-label="Delete request" className="rounded-xl border border-red-200 p-2 text-red-700"><Trash2 size={16}/></button></form></div></div>
  </article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><h2 className="text-xl font-black">No part requests yet</h2><p className="mx-auto mt-2 max-w-lg text-[#63706a]">When a compatible part is missing, you can save exactly what you need instead of starting the search again later.</p></div>}
 </main></>;
}
