"use client";

import { useActionState } from "react";
import { submitFoundingSellerApplication,type FoundingSellerApplicationState } from "@/app/founding-sellers/actions";

const initial:FoundingSellerApplicationState={status:"idle"};

type InviteInitial={
 email?:string;
 phone?:string;
 businessName?:string;
 businessKind?:string;
 postcode?:string;
 website?:string;
 estimatedActiveParts?:number|null;
 channels?:string[];
 importInterest?:string;
};

export function FoundingSellerApplicationForm({source="website",inviteToken="",initialValues={}}:{source?:string;inviteToken?:string;initialValues?:InviteInitial}){
 const [state,action,pending]=useActionState(submitFoundingSellerApplication,initial);
 return <form action={action} className="rounded-[28px] border border-black/10 bg-white p-5 sm:p-7">
  <input type="hidden" name="source" value={source}/><input type="hidden" name="inviteToken" value={inviteToken}/>
  <div className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
   <label>Company website confirmation<input name="companyWebsite" tabIndex={-1} autoComplete="off"/></label>
  </div>
  <div className="grid gap-4 sm:grid-cols-2">
   <label className="text-sm font-black">Contact name<input required minLength={2} maxLength={120} name="contactName" autoComplete="name" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3"/></label>
   <label className="text-sm font-black">Business email<input required type="email" maxLength={320} name="email" defaultValue={initialValues.email??""} autoComplete="email" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3"/></label>
   <label className="text-sm font-black">Phone <span className="font-normal text-[#63706a]">(optional)</span><input maxLength={80} name="phone" defaultValue={initialValues.phone??""} autoComplete="tel" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3"/></label>
   <label className="text-sm font-black">Business name<input required minLength={2} maxLength={160} name="businessName" defaultValue={initialValues.businessName??""} autoComplete="organization" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3"/></label>
   <label className="text-sm font-black">Business type<select required defaultValue={initialValues.businessKind??""} name="businessKind" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3"><option value="" disabled>Choose one</option><option value="breaker">Vehicle breaker</option><option value="atf">ATF / vehicle dismantler</option><option value="garage">Garage / workshop</option><option value="parts_business">Parts business / retailer</option><option value="other">Other automotive business</option></select></label>
   <label className="text-sm font-black">Postcode<input required maxLength={20} name="postcode" defaultValue={initialValues.postcode??""} autoComplete="postal-code" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 uppercase"/></label>
   <label className="text-sm font-black sm:col-span-2">Website or eBay shop URL <span className="font-normal text-[#63706a]">(optional)</span><input maxLength={500} name="website" defaultValue={initialValues.website??""} inputMode="url" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3" placeholder="https://..."/></label>
   <label className="text-sm font-black">Approx. active parts in stock <span className="font-normal text-[#63706a]">(optional)</span><input type="number" min={0} max={10000000} step={1} name="estimatedActiveParts" defaultValue={initialValues.estimatedActiveParts??undefined} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3" placeholder="e.g. 5000"/></label>
   <label className="text-sm font-black">Preferred inventory onboarding<select required defaultValue={initialValues.importInterest??"unsure"} name="importInterest" className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3"><option value="unsure">Not sure yet</option><option value="ai_manual">AI / manual listing</option><option value="csv">CSV bulk import</option><option value="ebay">Existing eBay inventory</option><option value="api">API / system integration</option></select></label>
  </div>

  <fieldset className="mt-5">
   <legend className="text-sm font-black">Where do you currently sell parts? <span className="font-normal text-[#63706a]">(select any)</span></legend>
   <div className="mt-3 grid gap-2 sm:grid-cols-3">
    {[["ebay","eBay"],["own_website","Own website"],["physical_counter","Trade counter / shop"],["facebook","Facebook / social"],["other","Other"],["none","Not online yet"]].map(([value,label])=><label key={value} className="flex items-center gap-2 rounded-xl bg-[#f8f7f2] p-3 text-sm font-bold"><input type="checkbox" name="channels" value={value} defaultChecked={initialValues.channels?.includes(value)}/>{label}</label>)}
   </div>
  </fieldset>

  <label className="mt-5 block text-sm font-black">Anything useful for onboarding? <span className="font-normal text-[#63706a]">(optional)</span><textarea name="notes" maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3" placeholder="Current inventory format, team size, categories, migration concerns or questions."/></label>

  <label className="mt-5 flex items-start gap-3 rounded-xl bg-[#f4f7f2] p-4 text-sm leading-6"><input required type="checkbox" name="consent" className="mt-1"/><span>I agree that SecondPart may contact me about this Founding Seller application and seller onboarding.</span></label>

  {state.message&&<div role="status" className={`mt-5 rounded-xl p-4 text-sm font-bold ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-900"}`}>{state.message}</div>}
  <button disabled={pending||state.status==="success"} className="mt-5 w-full rounded-xl bg-[#173c31] px-5 py-3.5 font-black text-white disabled:opacity-60">{pending?"Submitting…":state.status==="success"?"Application received":"Apply to the Founding Seller Programme"}</button>
  <p className="mt-3 text-xs leading-5 text-[#63706a]">Applying does not create a contract or guarantee programme acceptance. Commercial terms are confirmed separately before activation.</p>
 </form>;
}
