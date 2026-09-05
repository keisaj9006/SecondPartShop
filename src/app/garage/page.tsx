import Link from "next/link";
import { CarFront,Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { getGarageVehicles } from "@/lib/data/garage";
import { removeGarageVehicle } from "./actions";

export const dynamic="force-dynamic";

const vehicleHref=(vehicle:{catalogueVariantId:string;year:number;fuelType:string|null;engineSizeSimple:number|null;registration:string|null})=>{
 const params=new URLSearchParams({cv:vehicle.catalogueVariantId,cy:String(vehicle.year)});
 if(vehicle.fuelType)params.set("cf",vehicle.fuelType);
 if(vehicle.engineSizeSimple!==null)params.set("ce",String(vehicle.engineSizeSimple));
 if(vehicle.registration)params.set("vr",vehicle.registration);
 return `/?${params.toString()}#marketplace`;
};

export default async function GaragePage(){
 const user=await requireUser("/garage");
 const vehicles=await getGarageVehicles(user.id);
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><h1 className="text-4xl font-black tracking-[-.045em]">SecondPart Garage</h1><p className="mt-2 max-w-2xl text-[#63706a]">Save vehicles you shop for often, then switch compatibility filters in one click.</p></div>
   <Link href="/#marketplace" className="w-fit rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Add a vehicle</Link>
  </div>
  {vehicles.length?<div className="mt-8 grid gap-4 md:grid-cols-2">{vehicles.map(vehicle=><article key={vehicle.id} className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
   <div className="flex items-start justify-between gap-4">
    <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><CarFront size={21}/></span><div>{vehicle.registration&&<p className="text-xs font-black uppercase tracking-[.14em] text-[#287154]">{vehicle.registration}</p>}<h2 className="mt-1 text-xl font-black">{vehicle.make} {vehicle.modelFamily}</h2><p className="mt-1 text-sm text-[#63706a]">{vehicle.year} · {vehicle.variant}{vehicle.engineSizeSimple?` · ${vehicle.engineSizeSimple}cc`:""}{vehicle.fuelType?` · ${vehicle.fuelType}`:""}</p>{vehicle.nickname&&<p className="mt-2 text-sm font-bold">{vehicle.nickname}</p>}</div></div>
    <form action={removeGarageVehicle}><input type="hidden" name="id" value={vehicle.id}/><button aria-label={`Remove ${vehicle.make} ${vehicle.modelFamily} from garage`} className="rounded-full border border-red-200 p-2 text-red-700 hover:bg-red-50"><Trash2 size={17}/></button></form>
   </div>
   <Link href={vehicleHref(vehicle)} className="mt-5 block rounded-xl bg-[#d4f44d] px-4 py-3 text-center text-sm font-black">Use this vehicle</Link>
  </article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><CarFront className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">Your Garage is empty</h2><p className="mx-auto mt-2 max-w-lg text-[#63706a]">Select a vehicle on the marketplace and save it here for faster future searches.</p><Link href="/#marketplace" className="mt-5 inline-block rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Find my vehicle</Link></div>}
 </main></>;
}
