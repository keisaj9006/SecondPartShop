import Link from "next/link";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { getFittingPart,getGaragePartnersPage } from "@/lib/data/fitting";
import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { isUuid } from "@/lib/identifiers";
import { requestFittingQuote } from "./actions";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{const n=Number(value);return Number.isInteger(n)?n:undefined;};

export default async function FitPartPage({params,searchParams}:{params:Promise<{partId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{partId},query,user]=await Promise.all([params,searchParams,getCurrentUser()]);
 if(!isUuid(partId))return <><Header/><main className="mx-auto max-w-3xl px-4 py-14"><h1 className="text-3xl font-black">Part unavailable</h1></main></>;
 const variantId=first(query.cv);
 const year=integer(first(query.cy));
 const fuel=first(query.cf);
 const engine=integer(first(query.ce));
 const registration=first(query.vr);
 const [part,garages,vehicle]=await Promise.all([
  getFittingPart(partId),
  getGaragePartnersPage(0,40).catch(()=>({items:[],hasMore:false,offset:0,limit:40})),
  variantId&&isUuid(variantId)&&year!==undefined?getCatalogueSelection(variantId,year,fuel,engine).catch(()=>null):Promise.resolve(null)
 ]);
 if(!part)return <><Header/><main className="mx-auto max-w-3xl px-4 py-14"><h1 className="text-3xl font-black">Listing unavailable</h1></main></>;
 const partHref="/parts/"+part.slug;
 return <><Header/><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
  <Link href={partHref} className="text-sm font-black underline">Back to part</Link><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#287154]">Buy + Fit</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Request fitting for {part.title}</h1>
  <p className="mt-2 max-w-3xl text-[#63706a]">Request a labour-only quote. The garage is not confirming part compatibility by sending a quote, and the part purchase remains a separate SecondPart transaction.</p>
  {!vehicle?<div className="mt-7 rounded-3xl bg-amber-50 p-6"><h2 className="text-xl font-black text-amber-950">Select your exact vehicle first</h2><p className="mt-2 text-sm leading-6 text-amber-900">Buy + Fit needs the catalogue vehicle snapshot so the garage knows what vehicle the work is for.</p><Link href={"/?addVehicle=1#vehicle-picker"} className="mt-4 inline-block rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Choose vehicle</Link></div>:<>
   <div className="mt-6 rounded-2xl bg-[#f4f7f2] p-4 text-sm"><strong>{registration?registration+" · ":""}{vehicle.make} {vehicle.modelFamily} · {vehicle.year}{vehicle.engineSizeSimple?" · "+vehicle.engineSizeSimple+"cc":""}{vehicle.fuelType?" · "+vehicle.fuelType:""}</strong></div>
   {!user&&<div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Sign in before sending a fitting request. <Link href={"/account?returnTo="+encodeURIComponent("/fit/"+partId+"?"+new URLSearchParams(Object.fromEntries(Object.entries({cv:variantId,cy:String(year),cf:fuel,ce:engine!==undefined?String(engine):undefined,vr:registration}).filter((entry):entry is [string,string]=>Boolean(entry[1])))).toString())} className="underline">Sign in</Link></div>}
   {garages.items.length?<div className="mt-7 grid gap-4 md:grid-cols-2">{garages.items.map(garage=><article key={garage.id} className="rounded-3xl border border-black/10 bg-white p-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">{garage.businessName}</h2><p className="mt-1 text-sm font-bold">{garage.location} · {garage.postcode}</p></div>{garage.verifiedAt&&<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">Verified</span>}</div>
    <p className="mt-3 text-sm leading-6 text-[#63706a]">{garage.description}</p>
    {user&&<form action={requestFittingQuote} className="mt-4"><input type="hidden" name="partId" value={part.id}/><input type="hidden" name="garagePartnerId" value={garage.id}/><input type="hidden" name="variantId" value={vehicle.variantId}/><input type="hidden" name="year" value={vehicle.year}/>{vehicle.fuelType&&<input type="hidden" name="fuel" value={vehicle.fuelType}/>} {vehicle.engineSizeSimple!==null&&<input type="hidden" name="engine" value={vehicle.engineSizeSimple}/>} {registration&&<input type="hidden" name="registration" value={registration}/>}<label className="text-xs font-black">Note for garage <span className="font-normal text-[#63706a]">(optional)</span><textarea name="notes" maxLength={1000} rows={2} className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2" placeholder="Any useful fitting context or timing request"/></label><button className="mt-3 w-full rounded-xl bg-[#173c31] px-4 py-3 text-sm font-black text-white">Request labour quote</button></form>}
   </article>)}</div>:<div className="mt-7 rounded-3xl border border-dashed border-black/20 p-8 text-center"><h2 className="text-xl font-black">No active fitting partners yet</h2><p className="mt-2 text-sm text-[#63706a]">The Buy + Fit network is being built. You can still buy the part without fitting.</p></div>}
  </>}
 </main></>;
}
