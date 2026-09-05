import Link from "next/link";
import { CarFront,Plus,Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { requireSeller } from "@/lib/auth";
import { getDonorVehicles } from "@/lib/data/donor-vehicles";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { deleteDonorVehicle } from "./actions";
import { redirect } from "next/navigation";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function DonorVehiclesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{user},params]=await Promise.all([requireSeller("/dashboard/donors"),searchParams]);
 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard");
 const donors=await getDonorVehicles(seller.id);
 return <><Header/><main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
   <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Seller inventory</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Donor vehicles</h1><p className="mt-2 max-w-2xl text-[#63706a]">Add a vehicle once, then reuse it across every part removed from that donor. Registration stays private to the seller workflow.</p></div>
   <Link href="/dashboard/donors/new" className="inline-flex w-fit items-center gap-2 rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white"><Plus size={17}/>Add donor vehicle</Link>
  </div>
  {first(params.created)==="1"&&<p className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Donor vehicle saved.</p>}
  {donors.length?<div className="mt-8 grid gap-4 md:grid-cols-2">{donors.map(donor=><article key={donor.id} className="rounded-3xl border border-black/10 bg-white p-5">
   <div className="flex items-start justify-between gap-4">
    <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><CarFront size={21}/></span><div>{donor.registration&&<p className="font-mono text-xs font-black uppercase tracking-[.14em] text-[#287154]">{donor.registration}</p>}<h2 className="mt-1 text-xl font-black">{donor.make} {donor.model}</h2><p className="mt-1 text-sm text-[#63706a]">{donor.year}{donor.variant?" · "+donor.variant:""}{donor.engineSizeSimple?" · "+donor.engineSizeSimple+"cc":""}{donor.fuelType?" · "+donor.fuelType:""}{donor.colour?" · "+donor.colour:""}</p></div></div>
    <form action={deleteDonorVehicle}><input type="hidden" name="id" value={donor.id}/><button aria-label={"Delete "+donor.make+" "+donor.model+" donor"} className="rounded-full border border-red-200 p-2 text-red-700 hover:bg-red-50"><Trash2 size={17}/></button></form>
   </div>
   {donor.notes&&<p className="mt-4 rounded-xl bg-[#f8f7f2] p-3 text-sm leading-6 text-[#63706a]">{donor.notes}</p>}
   <Link href={"/dashboard/listings/new?donor="+encodeURIComponent(donor.id)} className="mt-5 block rounded-xl bg-[#d4f44d] px-4 py-3 text-center text-sm font-black">Add a part from this donor</Link>
  </article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><CarFront className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No donor vehicles yet</h2><p className="mx-auto mt-2 max-w-xl text-[#63706a]">Add the first donor vehicle to speed up listing parts from the same car.</p></div>}
 </main></>;
}
