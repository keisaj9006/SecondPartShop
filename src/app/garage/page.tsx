import Link from "next/link";
import { CarFront,Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { VehicleVisual } from "@/components/vehicle-visual";
import { requireUser } from "@/lib/auth";
import { getGarageVehiclesPage } from "@/lib/data/garage";
import { removeGarageVehicle } from "./actions";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

const vehicleHref=(vehicle:{catalogueVariantId:string;year:number;fuelType:string|null;engineSizeSimple:number|null;registration:string|null;colour:string|null})=>{
 const params=new URLSearchParams({cv:vehicle.catalogueVariantId,cy:String(vehicle.year)});
 if(vehicle.fuelType)params.set("cf",vehicle.fuelType);
 if(vehicle.engineSizeSimple!==null)params.set("ce",String(vehicle.engineSizeSimple));
 if(vehicle.registration)params.set("vr",vehicle.registration);
 if(vehicle.colour)params.set("vc",vehicle.colour);
 return `/?${params.toString()}#marketplace`;
};

export default async function GaragePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [user,params]=await Promise.all([requireUser("/garage"),searchParams]);
 const page=pageNumber(first(params.page));
 const pageSize=20;
 const result=await getGarageVehiclesPage(user.id,{offset:(page-1)*pageSize,limit:pageSize});
 const vehicles=result.items;
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><h1 className="text-3xl font-black tracking-[-.045em] sm:text-4xl">SecondPart Garage</h1><p className="mt-2 max-w-2xl text-[#63706a]">Save vehicles you shop for often, then switch compatibility filters in one click.</p></div>
   <Link href="/?addVehicle=1#vehicle-picker" className="w-fit rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Add a vehicle</Link>
  </div>
  {vehicles.length?<div className="mt-8 grid gap-4 md:grid-cols-2">{vehicles.map(vehicle=><article key={vehicle.id} className="min-w-0 rounded-3xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
   <VehicleVisual make={vehicle.make} model={vehicle.modelFamily} year={vehicle.year} colour={vehicle.colour} variant={vehicle.variant} registration={vehicle.registration} engine={vehicle.engineSizeSimple?vehicle.engineSizeSimple+"cc":null} fuel={vehicle.fuelType}/>
   <div className="mt-4 flex min-w-0 items-start justify-between gap-3">
    <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><CarFront size={21}/></span><div className="min-w-0">{vehicle.registration&&<p className="text-xs font-black uppercase tracking-[.14em] text-[#287154]">{vehicle.registration}</p>}<h2 className="mt-1 break-words text-lg font-black sm:text-xl">{vehicle.make} {vehicle.modelFamily}</h2><p className="mt-1 break-words text-sm text-[#63706a]">{vehicle.year} · {vehicle.variant}{vehicle.engineSizeSimple?` · ${vehicle.engineSizeSimple}cc`:""}{vehicle.fuelType?` · ${vehicle.fuelType}`:""}</p>{vehicle.nickname&&<p className="mt-2 text-sm font-bold">{vehicle.nickname}</p>}</div></div>
    <form action={removeGarageVehicle}><input type="hidden" name="id" value={vehicle.id}/><button aria-label={`Remove ${vehicle.make} ${vehicle.modelFamily} from garage`} className="rounded-full border border-red-200 p-2 text-red-700 hover:bg-red-50"><Trash2 size={17}/></button></form>
   </div>
   <Link href={vehicleHref(vehicle)} className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-[#d4f44d] px-4 py-3 text-center text-sm font-black">Use this vehicle</Link>
  </article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><CarFront className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">Your Garage is empty</h2><p className="mx-auto mt-2 max-w-lg text-[#63706a]">Select a vehicle on the marketplace and save it here for faster future searches.</p><Link href="/?addVehicle=1#vehicle-picker" className="mt-5 inline-block rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Find my vehicle</Link></div>}
 {(page>1||result.hasMore)&&<nav aria-label="Garage pages" className="mt-8 flex items-center justify-center gap-3">{page>1&&<Link href={page===2?"/garage":"/garage?page="+(page-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {page}</span>{result.hasMore&&<Link href={"/garage?page="+(page+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}</nav>}
 </main></>;
}
