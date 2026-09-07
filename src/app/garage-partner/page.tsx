import Link from "next/link";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";
import { getGaragePartnerForOwner } from "@/lib/data/fitting";
import { saveGaragePartner } from "./actions";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function GaragePartnerPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const user=await getCurrentUser();
 if(!user)return <><Header/><main className="mx-auto max-w-3xl px-4 py-14 sm:px-6"><h1 className="text-4xl font-black">Join the Buy + Fit network</h1><p className="mt-3 text-[#63706a]">Garage partners can quote labour for fitting customer-supplied recycled parts. You do not need to become a parts seller.</p><Link href="/account?returnTo=%2Fgarage-partner" className="mt-6 inline-block rounded-xl bg-[#173c31] px-5 py-3 font-black text-white">Sign in to apply</Link></main></>;
 const partner=await getGaragePartnerForOwner(user.id).catch(()=>null);
 const status=partner?.status;
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
  <Link href="/garages" className="text-sm font-black underline">View garage network</Link>
  <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#287154]">Buy + Fit</p>
  <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">{partner?"Garage partner profile":"Join as a garage partner"}</h1>
  <p className="mt-2 max-w-2xl text-[#63706a]">Offer labour quotes for fitting parts bought or found through SecondPart. Labour payments are not collected by SecondPart in this first version.</p>
  {first(params.saved)==="1"&&<div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Garage details saved. {partner?.status==="active"?"Your garage remains active unless identity details require a fresh review.":"Your application is awaiting review."}</div>}
  {first(params.error)&&<div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">We could not save those garage details. Check the required fields and try again.</div>}
  {partner&&<div className={"mt-5 rounded-2xl p-4 text-sm font-bold "+(status==="active"?"bg-emerald-50 text-emerald-900":status==="rejected"?"bg-red-50 text-red-900":"bg-amber-50 text-amber-900")}>Status: <strong className="capitalize">{status}</strong>{partner.verifiedAt?" · verified garage partner":""}.{status==="active"&&<Link href="/garage-partner/requests" className="ml-2 underline">Open fitting requests</Link>}</div>}
  <form action={saveGaragePartner} className="mt-7 grid gap-5 rounded-3xl border border-black/10 bg-white p-5 sm:p-7 sm:grid-cols-2">
   <label className="text-sm font-bold sm:col-span-2">Business name<input required minLength={2} maxLength={140} name="businessName" defaultValue={partner?.businessName??""} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3"/></label>
   <label className="text-sm font-bold">Town / city<input required maxLength={120} name="location" defaultValue={partner?.location??""} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3"/></label>
   <label className="text-sm font-bold">Postcode<input required maxLength={20} name="postcode" defaultValue={partner?.postcode??""} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 uppercase"/></label>
   <label className="text-sm font-bold sm:col-span-2">About your workshop<textarea required minLength={20} maxLength={2000} rows={5} name="description" defaultValue={partner?.description??""} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3" placeholder="Services, vehicle types and useful information for buyers."/></label>
   <label className="flex gap-3 rounded-xl bg-[#f8f7f2] p-4 text-sm font-bold"><input type="checkbox" name="customerSuppliedParts" defaultChecked={partner?.customerSuppliedParts??true}/>I accept customer-supplied parts</label>
   <label className="flex gap-3 rounded-xl bg-[#f8f7f2] p-4 text-sm font-bold"><input type="checkbox" name="recycledParts" defaultChecked={partner?.recycledParts??true}/>I fit used / recycled parts</label>
   <label className="flex gap-3 rounded-xl bg-[#f8f7f2] p-4 text-sm font-bold sm:col-span-2"><input type="checkbox" name="mobileFitting" defaultChecked={partner?.mobileFitting??false}/>Mobile fitting / call-out may be available</label>
   <div className="sm:col-span-2 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-950">Changing business name, town/city or postcode on an active verified garage sends the profile back for review. This protects the Buy + Fit trust badge.</div>
   <button className="rounded-xl bg-[#173c31] px-5 py-3.5 font-black text-white sm:col-span-2">{partner?"Save garage profile":"Submit garage application"}</button>
  </form>
 </main></>;
}
