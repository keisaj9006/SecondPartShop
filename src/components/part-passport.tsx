import { BadgeCheck,Camera,CarFront,FileCheck2,ShieldCheck,Wrench } from "lucide-react";
import type { Listing } from "@/lib/types";
import type { PartPassportEvidence } from "@/lib/data/part-passport";
import { conditionLabel,testingStatusLabel,warrantyLabel } from "@/lib/listing-trust";

const value=(text:string|null|undefined)=>text?.trim()||"Not supplied";

export function PartPassport({listing,evidence}:{listing:Listing;evidence:PartPassportEvidence|null}){
 const donor=evidence?.donor??null;
 const identitySignals=[listing.oemNumber,listing.partNumber,listing.manufacturer].filter(Boolean).length;
 const evidenceScore=[
  listing.images.length>0,
  listing.testingStatus!=="not_specified",
  Boolean(listing.conditionNotes||listing.damageNotes),
  identitySignals>0,
  Boolean(donor),
  (evidence?.explicitFitmentCount??0)>0,
  (evidence?.verifiedFitReportCount??0)>0
 ].filter(Boolean).length;

 return <section className="mt-6 rounded-3xl border border-[#173c31]/15 bg-[#f4f7f2] p-5 sm:p-6">
  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
   <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Part Passport</p><h2 className="mt-1 text-2xl font-black">Evidence attached to this part</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">SecondPart keeps identity, provenance, condition and fitment evidence separate so buyers can see what is known and what still needs checking.</p></div>
   <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-[#173c31]"><ShieldCheck size={15}/>{evidenceScore}/7 evidence signals</span>
  </div>

  <div className="mt-5 grid gap-3 md:grid-cols-2">
   <div className="rounded-2xl bg-white p-4">
    <p className="flex items-center gap-2 text-sm font-black"><FileCheck2 size={17} className="text-[#287154]"/>Identity</p>
    <dl className="mt-3 grid gap-2 text-sm">
     <div><dt className="text-[#63706a]">OE/OEM</dt><dd className="break-all font-black">{value(listing.oemNumber)}</dd></div>
     <div><dt className="text-[#63706a]">Manufacturer / brand</dt><dd className="font-black">{value(listing.manufacturer)}</dd></div>
     <div><dt className="text-[#63706a]">Part number</dt><dd className="break-all font-black">{value(listing.partNumber)}</dd></div>
    </dl>
   </div>

   <div className="rounded-2xl bg-white p-4">
    <p className="flex items-center gap-2 text-sm font-black"><CarFront size={17} className="text-[#287154]"/>Provenance</p>
    {donor?<div className="mt-3 text-sm"><p className="font-black">{donor.make} {donor.model} · {donor.year}</p><p className="mt-1 leading-6 text-[#63706a]">{[donor.variant,donor.engineSizeSimple?donor.engineSizeSimple+"cc":null,donor.fuelType,donor.colour].filter(Boolean).join(" · ")||"Donor vehicle recorded"}</p><p className="mt-2 text-xs leading-5 text-[#63706a]">Seller donor evidence. Registration and private donor notes are not published.</p></div>:<p className="mt-3 text-sm leading-6 text-[#63706a]">No donor vehicle is attached to this listing. This can be normal for new stock or parts whose source vehicle is unknown.</p>}
   </div>

   <div className="rounded-2xl bg-white p-4">
    <p className="flex items-center gap-2 text-sm font-black"><Wrench size={17} className="text-[#287154]"/>Condition evidence</p>
    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
     <div><dt className="text-[#63706a]">Condition</dt><dd className="font-black">{conditionLabel(listing.condition)}</dd></div>
     <div><dt className="text-[#63706a]">Testing</dt><dd className="font-black">{testingStatusLabel(listing.testingStatus)}</dd></div>
     <div><dt className="text-[#63706a]">Warranty</dt><dd className="font-black">{warrantyLabel(listing.warrantyDays)}</dd></div>
     <div><dt className="text-[#63706a]">Real photos</dt><dd className="font-black">{listing.images.length}</dd></div>
     <div><dt className="text-[#63706a]">Dispatch</dt><dd className="font-black">{listing.dispatchDays===0?"Same working day":listing.dispatchDays+" working day"+(listing.dispatchDays===1?"":"s")}</dd></div>
    </dl>
    {listing.conditionNotes&&<div className="mt-3 rounded-xl bg-[#f8f7f2] p-3 text-sm"><p className="font-black">Condition notes</p><p className="mt-1 leading-6 text-[#63706a]">{listing.conditionNotes}</p></div>}
    {listing.damageNotes&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><p className="font-black text-amber-900">Visible damage / wear disclosed by seller</p><p className="mt-1 leading-6 text-amber-900/80">{listing.damageNotes}</p></div>}
    {(listing.conditionNotes||listing.damageNotes)&&<p className="mt-3 text-xs leading-5 text-[#63706a]"><BadgeCheck size={14} className="mr-1 inline text-[#287154]"/>Seller supplied condition / damage disclosure.</p>}
   </div>

   <div className="rounded-2xl bg-white p-4">
    <p className="flex items-center gap-2 text-sm font-black"><Camera size={17} className="text-[#287154]"/>Fitment evidence</p>
    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
     <div><dt className="text-[#63706a]">Explicit fitments</dt><dd className="font-black">{evidence?.explicitFitmentCount??0}</dd></div>
     <div><dt className="text-[#63706a]">Verified buyer reports</dt><dd className="font-black">{evidence?.verifiedFitReportCount??0}</dd></div>
    </dl>
    <p className="mt-3 text-xs leading-5 text-[#63706a]">A Part Passport records evidence; it does not turn incomplete evidence into a guaranteed fit. Always use the compatibility status for your selected vehicle.</p>
   </div>
  </div>
 </section>;
}
