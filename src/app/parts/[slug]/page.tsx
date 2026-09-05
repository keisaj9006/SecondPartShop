import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft,Check,MapPin,ShieldCheck,Truck } from "lucide-react";
import { CompatibilityBadge } from "@/components/compatibility-badge";
import { Header } from "@/components/header";
import { ProductGallery } from "@/components/product-gallery";
import { SaveButton } from "@/components/save-button";
import { getCurrentUser } from "@/lib/auth";
import { getPartCompatibility } from "@/lib/data/compatibility";
import { getListingBySlug,getSavedPartIds,getVehicles } from "@/lib/data/marketplace";
import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import type { MarketplaceFilters } from "@/lib/types";
import { testingStatusLabel,warrantyLabel } from "@/lib/listing-trust";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};
const contextKeys=["q","category","condition","min","max","pc","vehicle","vr","cv","cy","cf","ce"] as const;

export default async function PartPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{slug},rawSearch,user]=await Promise.all([params,searchParams,getCurrentUser()]);
 const result=await getListingBySlug(slug);
 if(result.configured&&!result.data&&!result.error)notFound();
 const item=result.data;
 if(!item)return <><Header/><main className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-3xl font-black">Listing unavailable</h1><p className="mt-3 rounded-xl bg-amber-50 p-4 text-amber-900">{result.error??"This listing could not be loaded."}</p></main></>;

 const context=new URLSearchParams();
 for(const key of contextKeys){const value=first(rawSearch[key]);if(value)context.set(key,value);}
 const filters:MarketplaceFilters={
  query:first(rawSearch.q),
  category:first(rawSearch.category),
  postcode:first(rawSearch.pc),
  vehicle:first(rawSearch.vehicle),
  vehicleRegistration:first(rawSearch.vr),
  catalogueVariant:first(rawSearch.cv),
  catalogueYear:integer(first(rawSearch.cy)),
  catalogueFuel:first(rawSearch.cf),
  catalogueEngineSize:integer(first(rawSearch.ce))
 };
 const compatibility=await getPartCompatibility(item.id,filters);
 let vehicleLabel:string|null=null;
 if(filters.catalogueVariant&&filters.catalogueYear!==undefined){
  const selected=await getCatalogueSelection(filters.catalogueVariant,filters.catalogueYear,filters.catalogueFuel,filters.catalogueEngineSize);
  if(selected)vehicleLabel=`${selected.make} ${selected.modelFamily} · ${selected.year}${selected.engineSizeSimple?` · ${selected.engineSizeSimple}cc`:""}${selected.fuelType?` · ${selected.fuelType}`:""}`;
 }else if(filters.vehicle){
  const vehicles=await getVehicles();
  const selected=vehicles.find(vehicle=>vehicle.id===filters.vehicle);
  if(selected)vehicleLabel=`${selected.make} ${selected.model} ${selected.generation} · ${selected.year} · ${selected.engine}`;
 }
 if(filters.vehicleRegistration&&vehicleLabel)vehicleLabel=`${filters.vehicleRegistration} · ${vehicleLabel}`;

 const savedIds=user?await getSavedPartIds(user.id):[];
 const backHref=context.toString()?`/?${context.toString()}#marketplace`:"/#marketplace";

 return <><Header/><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
  <Link href={backHref} className="mb-6 inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft size={16}/>Back to results</Link>
  <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
   <ProductGallery images={item.images} alt={item.title}/>
   <div>
    <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#e8eee9] px-3 py-1 text-xs font-bold capitalize">{item.condition}</span><span className="rounded-full bg-[#e8eee9] px-3 py-1 text-xs font-bold">{item.stock} in stock</span>{compatibility&&<CompatibilityBadge info={compatibility}/>}</div>
    <h1 className="mt-5 text-4xl font-black tracking-[-.045em]">{item.title}</h1>
    <p className="mt-7 text-4xl font-black">£{(item.pricePence/100).toLocaleString("en-GB",{minimumFractionDigits:2})}</p>

    {compatibility&&<section className="mt-6 rounded-2xl border border-black/10 bg-[#f8f7f2] p-5">
     <p className="text-xs font-black uppercase tracking-[.14em] text-[#287154]">Compatibility confidence</p>
     {vehicleLabel&&<p className="mt-2 text-sm font-black">{vehicleLabel}</p>}
     <p className="mt-2 text-sm leading-6 text-[#56625d]">{compatibility.detail}</p>
     <details className="mt-3 text-sm"><summary className="cursor-pointer font-black underline">Why this match?</summary><p className="mt-2 leading-6 text-[#63706a]">{compatibility.level==="confirmed"?"SecondPart found an explicit fitment record for this exact selected vehicle configuration.":compatibility.level==="family_match"?"SecondPart found fitment evidence for another derivative in the same vehicle family. That is useful evidence, but it is not enough to claim an exact fit.":"No explicit exact-fit or same-family fitment record is available for this listing and vehicle."}{item.oemNumber?` Compare the vehicle's OE/OEM requirement with ${item.oemNumber} before ordering.`:""}</p></details>
    </section>}

    <dl className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-[#eef1eb] p-4 text-sm"><div><dt className="text-[#63706a]">OE/OEM number</dt><dd className="font-bold">{item.oemNumber??"Not supplied"}</dd></div><div><dt className="text-[#63706a]">Part number</dt><dd className="font-bold">{item.partNumber??"Not supplied"}</dd></div><div><dt className="text-[#63706a]">Manufacturer</dt><dd className="font-bold">{item.manufacturer??"Not supplied"}</dd></div><div><dt className="text-[#63706a]">Dispatch</dt><dd className="font-bold">{item.dispatchDays===0?"Same day":`${item.dispatchDays} working day${item.dispatchDays===1?"":"s"}`}</dd></div></dl>
    <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-[#287154]">Part condition & seller evidence</p><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[#63706a]">Condition</dt><dd className="font-black capitalize">{item.condition}</dd></div><div><dt className="text-[#63706a]">Testing</dt><dd className="font-black">{testingStatusLabel(item.testingStatus)}</dd></div><div><dt className="text-[#63706a]">Seller warranty</dt><dd className="font-black">{warrantyLabel(item.warrantyDays)}</dd></div><div><dt className="text-[#63706a]">Photos</dt><dd className="font-black">{item.images.length} real product photo{item.images.length===1?"":"s"}</dd></div></dl>{item.conditionNotes&&<div className="mt-4 rounded-xl bg-[#f8f7f2] p-3 text-sm"><p className="font-black">Condition notes</p><p className="mt-1 leading-6 text-[#63706a]">{item.conditionNotes}</p></div>}{item.damageNotes&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><p className="font-black text-amber-900">Visible damage / wear disclosed by seller</p><p className="mt-1 leading-6 text-amber-900/80">{item.damageNotes}</p></div>}</section><p className="mt-5 leading-7 text-[#63706a]">{item.description}</p>

    {item.category.isTransmissionRelated&&(item.gearboxFamily||item.gearboxCode)&&<details className="mt-5 rounded-2xl border border-black/10 bg-white p-4"><summary className="cursor-pointer text-sm font-black">Technical details</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{item.gearboxFamily&&<div><dt className="text-[#63706a]">Transmission family</dt><dd className="font-mono font-bold">{item.gearboxFamily}</dd></div>}{item.gearboxCode&&<div><dt className="text-[#63706a]">Transmission code</dt><dd className="font-mono font-bold">{item.gearboxCode}</dd></div>}</dl></details>}

    <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5"><p className="font-bold">Recorded compatibility</p>{item.fitments.length?<ul className="mt-3 space-y-3">{item.fitments.map(({vehicle,notes})=><li key={vehicle.id} className="flex items-start gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-[#287154]"/><span><strong>{vehicle.make} {vehicle.model} {vehicle.generation}</strong> · {vehicle.year} · {vehicle.engine}{vehicle.fuelType?` · ${vehicle.fuelType}`:""}{notes&&<small className="mt-1 block text-[#63706a]">{notes}</small>}</span></li>)}</ul>:<p className="mt-2 text-sm text-[#63706a]">Compatibility has not been confirmed for a specific legacy QA vehicle. Use the compatibility confidence above when shopping with a selected catalogue vehicle.</p>}</div>

    <div className="mt-5 grid grid-cols-2 gap-3"><SaveButton partId={item.id} initialSaved={savedIds.includes(item.id)}/><Link href={`/seller/${item.seller.slug}`} className="grid place-items-center rounded-xl bg-[#d4f44d] px-5 py-3 text-center font-black">View seller</Link></div>
    <div className="mt-6 grid gap-3 rounded-2xl bg-[#173c31] p-5 text-sm text-white">{item.seller.verified&&<span className="flex items-center gap-2"><ShieldCheck className="text-[#d4f44d]" size={18}/>Verified seller</span>}<span className="flex items-center gap-2"><MapPin className="text-[#d4f44d]" size={18}/>{item.seller.businessName}, {item.seller.location}</span>{item.collectionAvailable&&<span className="flex items-center gap-2"><MapPin className="text-[#d4f44d]" size={18}/>Local collection available</span>}{item.deliveryDaysMin!==null&&item.deliveryDaysMax!==null&&<span className="flex items-center gap-2"><Truck className="text-[#d4f44d]" size={18}/>Seller estimate: {item.deliveryDaysMin}–{item.deliveryDaysMax} working days</span>}<span className="flex items-center gap-2"><Truck className="text-[#d4f44d]" size={18}/>Stock and dispatch supplied by the seller</span></div>
   </div>
  </div>
 </main></>;
}
