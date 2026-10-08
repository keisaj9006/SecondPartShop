import Link from "next/link";
import { Header } from "@/components/header";
import { GarageVehicleList } from "@/components/garage-vehicle-list";
import { requireUser } from "@/lib/auth";
import { getGarageVehicleById,getGarageVehiclesPage } from "@/lib/data/garage";
import { resolveVehicleContext } from "@/lib/vehicle-context";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export default async function GaragePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [user,params]=await Promise.all([requireUser("/garage"),searchParams]);
 const page=pageNumber(first(params.page));
 const pageSize=20;
 const result=await getGarageVehiclesPage(user.id,{offset:(page-1)*pageSize,limit:pageSize});
 const vehicles=result.items;
 const contextParams=new URLSearchParams();
 for(const [key,value] of Object.entries(params)){
  const candidate=first(value);
  if(candidate!==undefined)contextParams.set(key,candidate);
 }
 const hasExplicitVehicleContext=["gv","cv","cy","cf","ce","vehicle"].some(key=>contextParams.has(key));
 const hasGarageContext=contextParams.has("gv");
 const garageId=contextParams.get("gv");
 const garageVehicle=hasGarageContext&&garageId&&isUuid(garageId)?await getGarageVehicleById(user.id,garageId):null;
 const resolved=resolveVehicleContext(contextParams,{viewerId:user.id,...(hasGarageContext?{garageValid:Boolean(garageVehicle)}:{})});
 const initialSelection=hasExplicitVehicleContext
  ?resolved.selection.kind==="garage"||resolved.selection.kind==="catalogue"||resolved.selection.kind==="legacy"?resolved.selection:null
  :undefined;
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><h1 className="text-3xl font-black tracking-[-.045em] sm:text-4xl">SecondPart Garage</h1><p className="mt-2 max-w-2xl text-[#63706a]">Save multiple vehicles. One is current at a time, and the compatibility filter applies only to that vehicle.</p></div>
   <Link href="/?addVehicle=1#vehicle-picker" className="w-fit rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Add a vehicle</Link>
  </div>
  <GarageVehicleList vehicles={vehicles} viewerId={user.id} initialSelection={initialSelection}/>
 {(page>1||result.hasMore)&&<nav aria-label="Garage pages" className="mt-8 flex items-center justify-center gap-3">{page>1&&<Link href={page===2?"/garage":"/garage?page="+(page-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {page}</span>{result.hasMore&&<Link href={"/garage?page="+(page+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}</nav>}
 </main></>;
}
