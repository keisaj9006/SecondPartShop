import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft,Check,Flag,MapPin,ShieldCheck,Truck,Wrench } from "lucide-react";
import { AskSellerForm } from "@/components/ask-seller-form";
import { BuyNowForm } from "@/components/buy-now-form";
import { CompatibilityBadge } from "@/components/compatibility-badge";
import { Header } from "@/components/header";
import { MarketplaceUserBlockButton } from "@/components/marketplace-user-block-button";
import { ProductGallery } from "@/components/product-gallery";
import { PartPassport } from "@/components/part-passport";
import { SaveButton } from "@/components/save-button";
import { RecentlyViewedTracker } from "@/components/recently-viewed-tracker";
import { getCurrentUser } from "@/lib/auth";
import { getPartCompatibility } from "@/lib/data/compatibility";
import { isSellerCheckoutReady } from "@/lib/data/checkout";
import { getListingBySlug,getSavedPartIdsForParts,getVehicleById } from "@/lib/data/marketplace";
import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { getPublicMemberProfileById } from "@/lib/data/reputation";
import { getPartPassportEvidence } from "@/lib/data/part-passport";
import type { MarketplaceFilters } from "@/lib/types";
import { conditionLabel } from "@/lib/listing-trust";
import { isUuid } from "@/lib/identifiers";
import { isStripeCheckoutConfigured } from "@/lib/stripe-payments";
import { isMarketplaceUserBlocked } from "@/lib/marketplace-policy";
import { getSellerDistanceFromPostcode } from "@/lib/seller-geo";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};
const contextKeys=["q","category","condition","sort","min","max","pc","collection","vehicle","vr","vc","cv","cy","cf","ce","fit","page"] as const;

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
  collectionOnly:first(rawSearch.collection)==="1",
  vehicle:isUuid(first(rawSearch.vehicle))?first(rawSearch.vehicle):undefined,
  vehicleRegistration:first(rawSearch.vr),
  vehicleColour:first(rawSearch.vc),
  catalogueVariant:isUuid(first(rawSearch.cv))?first(rawSearch.cv):undefined,
  catalogueYear:integer(first(rawSearch.cy)),
  catalogueFuel:first(rawSearch.cf),
  catalogueEngineSize:integer(first(rawSearch.ce))
 };
 const compatibility=await getPartCompatibility(item.id,filters).catch(()=>null);
 let vehicleLabel:string|null=null;
 let checkoutVehicleContext:{variantId:string;year:number;fuel?:string;engine?:number;registration?:string}|undefined;
 if(filters.catalogueVariant&&filters.catalogueYear!==undefined){
  const selected=await getCatalogueSelection(filters.catalogueVariant,filters.catalogueYear,filters.catalogueFuel,filters.catalogueEngineSize).catch(()=>null);
  if(selected){
   vehicleLabel=`${selected.make} ${selected.modelFamily} · ${selected.year}${selected.engineSizeSimple?` · ${selected.engineSizeSimple}cc`:""}${selected.fuelType?` · ${selected.fuelType}`:""}`;
   checkoutVehicleContext={
    variantId:selected.variantId,
    year:selected.year,
    fuel:selected.fuelType??undefined,
    engine:selected.engineSizeSimple??undefined,
    registration:filters.vehicleRegistration
   };
  }
 }else if(filters.vehicle){
  const selected=await getVehicleById(filters.vehicle).catch(()=>null);
  if(selected)vehicleLabel=`${selected.make} ${selected.model} ${selected.generation} · ${selected.year} · ${selected.engine}`;
 }
 if(filters.vehicleRegistration&&vehicleLabel)vehicleLabel=`${filters.vehicleRegistration} · ${vehicleLabel}`;

 const sellerOwnerId=item.seller.ownerId;
 const ownListing=Boolean(user&&sellerOwnerId===user.id);
 const [savedIds,sellerTrust,sellerCheckoutReady,passportEvidence,sellerDistance,blockedSeller]=await Promise.all([
  user?getSavedPartIdsForParts(user.id,[item.id]):Promise.resolve([]),
  sellerOwnerId?getPublicMemberProfileById(sellerOwnerId).catch(()=>null):Promise.resolve(null),
  isSellerCheckoutReady(item.sellerId).catch(()=>false),
  getPartPassportEvidence(item.id).catch(()=>null),
  getSellerDistanceFromPostcode(item.sellerId,filters.postcode).catch(()=>null),
  user&&!ownListing&&sellerOwnerId?isMarketplaceUserBlocked(sellerOwnerId).catch(()=>false):Promise.resolve(false)
 ]);
 const backHref=context.toString()?`/?${context.toString()}#marketplace`:"/#marketplace";
 const currentHref=context.toString()?`/parts/${slug}?${context.toString()}`:`/parts/${slug}`;
 const reportHref=`/report?part=${encodeURIComponent(item.id)}&returnTo=${encodeURIComponent(currentHref)}`;
 const reportUserHref=sellerOwnerId?`/report-user?profile=${encodeURIComponent(sellerOwnerId)}&returnTo=${encodeURIComponent(currentHref)}`:null;
 const fitParams=new URLSearchParams();
 if(checkoutVehicleContext){
  fitParams.set("cv",checkoutVehicleContext.variantId);
  fitParams.set("cy",String(checkoutVehicleContext.year));
  if(checkoutVehicleContext.fuel)fitParams.set("cf",checkoutVehicleContext.fuel);
  if(checkoutVehicleContext.engine!==undefined)fitParams.set("ce",String(checkoutVehicleContext.engine));
  if(checkoutVehicleContext.registration)fitParams.set("vr",checkoutVehicleContext.registration);
 }
 const fitHref=checkoutVehicleContext?`/fit/${item.id}?${fitParams.toString()}`:null;

 return <><Header/>{user&&<RecentlyViewedTracker partId={item.id}/>}<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{first(rawSearch.reported)==="1"&&<div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Thanks. Your report was submitted for review.</div>}{first(rawSearch.checkout)==="cancelled"&&<div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Checkout cancelled. The temporary stock reservation was released unless Stripe had already started processing the payment.</div>}
  <Link href={backHref} className="mb-6 inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft size={16}/>Back to results</Link>
  <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
   <ProductGallery images={item.images} alt={item.title}/>
   <div>
    <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#e8eee9] px-3 py-1 text-xs font-bold capitalize">{conditionLabel(item.condition)}</span><span className="rounded-full bg-[#e8eee9] px-3 py-1 text-xs font-bold">{item.stock} in stock</span>{compatibility&&<CompatibilityBadge info={compatibility}/>}</div>
    <h1 className="mt-5 break-words text-3xl font-black tracking-[-.045em] sm:text-4xl">{item.title}</h1>
    <p className="mt-7 text-3xl font-black sm:text-4xl">£{(item.pricePence/100).toLocaleString("en-GB",{minimumFractionDigits:2})}</p>
    <p className="mt-1 text-sm font-bold text-[#63706a]">{item.shippingPence>0?`Delivery £${(item.shippingPence/100).toFixed(2)}`:"Free delivery"}{item.collectionAvailable?" · Collection available":""}</p>

    {compatibility&&<section className="mt-6 rounded-2xl border border-black/10 bg-[#f8f7f2] p-5">
     <p className="text-xs font-black uppercase tracking-[.14em] text-[#287154]">Compatibility confidence</p>
     {vehicleLabel&&<p className="mt-2 text-sm font-black">{vehicleLabel}</p>}
     <p className="mt-2 text-sm leading-6 text-[#56625d]">{compatibility.detail}</p>
     {compatibility.verifiedFit&&(compatibility.verifiedFit.exactFitCount+compatibility.verifiedFit.modifiedFitCount+compatibility.verifiedFit.didNotFitCount)>0&&<div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-950"><p className="font-black">Verified SecondPart purchase evidence</p><p className="mt-1">{compatibility.verifiedFit.exactFitCount} exact fit · {compatibility.verifiedFit.modifiedFitCount} fit with modification · {compatibility.verifiedFit.didNotFitCount} did not fit</p></div>}
     <details className="mt-3 text-sm"><summary className="cursor-pointer font-black underline">Why this match?</summary><p className="mt-2 leading-6 text-[#63706a]">{compatibility.level==="confirmed"?"SecondPart found an explicit fitment record for this exact selected vehicle configuration.":compatibility.level==="buyer_verified"?"At least two different buyers completed real SecondPart transactions for this part and confirmed an exact fit on this selected vehicle configuration.":compatibility.level==="family_match"?"SecondPart found fitment evidence for another derivative in the same vehicle family. That is useful evidence, but it is not enough to claim an exact fit.":"No explicit exact-fit, buyer-verified fit or same-family evidence is available for this listing and vehicle."}{item.oemNumber?` Compare the vehicle's OE/OEM requirement with ${item.oemNumber} before ordering.`:""}</p></details>
    </section>}

    <PartPassport listing={item} evidence={passportEvidence}/>
    <p className="mt-5 leading-7 text-[#63706a]">{item.description}</p>

    {item.category.isTransmissionRelated&&(item.gearboxFamily||item.gearboxCode)&&<details className="mt-5 rounded-2xl border border-black/10 bg-white p-4"><summary className="cursor-pointer text-sm font-black">Technical details</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{item.gearboxFamily&&<div><dt className="text-[#63706a]">Transmission family</dt><dd className="font-mono font-bold">{item.gearboxFamily}</dd></div>}{item.gearboxCode&&<div><dt className="text-[#63706a]">Transmission code</dt><dd className="font-mono font-bold">{item.gearboxCode}</dd></div>}</dl></details>}

    <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5"><p className="font-bold">Recorded compatibility</p>{item.fitments.length?<ul className="mt-3 space-y-3">{item.fitments.map(({vehicle,notes})=><li key={vehicle.id} className="flex items-start gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-[#287154]"/><span><strong>{vehicle.make} {vehicle.model} {vehicle.generation}</strong> · {vehicle.year} · {vehicle.engine}{vehicle.fuelType?` · ${vehicle.fuelType}`:""}{notes&&<small className="mt-1 block text-[#63706a]">{notes}</small>}</span></li>)}</ul>:<p className="mt-2 text-sm text-[#63706a]">Compatibility has not been confirmed for a specific legacy QA vehicle. Use the compatibility confidence above when shopping with a selected catalogue vehicle.</p>}</div>

    <BuyNowForm
      partId={item.id}
      stock={item.stock}
      shippingPence={item.shippingPence}
      collectionAvailable={item.collectionAvailable}
      signedIn={Boolean(user)}
      ownListing={ownListing}
      checkoutReady={isStripeCheckoutConfigured()&&sellerCheckoutReady}
      returnTo={currentHref}
      vehicleContext={checkoutVehicleContext}
      compatibility={compatibility}
    />
    {sellerOwnerId&&!blockedSeller&&<div className="mt-3"><AskSellerForm partId={item.id} signedIn={Boolean(user)} ownListing={ownListing} returnTo={currentHref}/></div>}
    {user&&!ownListing&&sellerOwnerId&&reportUserHref&&<div className="mt-3 flex flex-wrap items-center gap-3">
      <MarketplaceUserBlockButton targetProfileId={sellerOwnerId} blocked={blockedSeller} returnTo={currentHref}/>
      <Link href={reportUserHref} className="inline-flex items-center gap-2 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-black"><Flag size={16}/>Report user</Link>
      {blockedSeller&&<span className="text-xs font-bold text-[#63706a]">Pre-purchase messaging with this user is blocked.</span>}
    </div>}
    {!ownListing&&<div className="mt-3 rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173c31] text-[#d4f44d]"><Wrench size={18}/></span><div><p className="font-black">Buy + Fit</p><p className="mt-1 text-xs leading-5 text-[#63706a]">Ask an approved garage partner for a labour quote. Fitting is separate from the part payment and does not guarantee compatibility.</p></div></div>
      {fitHref?<Link href={fitHref} className="mt-3 flex items-center justify-center rounded-xl border border-[#173c31]/20 bg-white px-4 py-3 text-sm font-black">Request fitting quote</Link>:<Link href="/?addVehicle=1#vehicle-picker" className="mt-3 flex items-center justify-center rounded-xl border border-[#173c31]/20 bg-white px-4 py-3 text-sm font-black">Select vehicle for Buy + Fit</Link>}
    </div>}
    <div className="mt-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2"><SaveButton partId={item.id} initialSaved={savedIds.includes(item.id)}/><Link href={`/seller/${item.seller.slug}`} className="grid place-items-center rounded-xl bg-[#d4f44d] px-5 py-3 text-center font-black">View seller</Link></div>
    <div className="mt-6 grid gap-3 rounded-2xl bg-[#173c31] p-5 text-sm text-white">
      <div className="flex flex-wrap items-center gap-2">
        {item.seller.verified&&<span className="flex items-center gap-2"><ShieldCheck className="text-[#d4f44d]" size={18}/>Verified seller</span>}
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black capitalize">{item.seller.sellerType} seller</span>
      </div>
      <span className="flex items-center gap-2"><MapPin className="text-[#d4f44d]" size={18}/>{item.seller.businessName}, {item.seller.location}{sellerDistance?` · ${sellerDistance.approximate?"~":""}${sellerDistance.miles.toFixed(1)} mi away`:""}</span>
      {sellerTrust&&<div className="rounded-xl bg-white/10 p-3">
        <Link href={`/member/${sellerTrust.handle}`} className="font-black text-[#d4f44d] hover:underline">@{sellerTrust.handle}</Link>
        <p className="mt-1 font-bold">★ {sellerTrust.sellerRating?.toFixed(1)??"New"} · {sellerTrust.sellerReviewCount} verified reviews · {sellerTrust.soldCount} sold · {sellerTrust.boughtCount} bought</p>
      </div>}
      {item.collectionAvailable&&<span className="flex items-center gap-2"><MapPin className="text-[#d4f44d]" size={18}/>Local collection available</span>}
      {item.deliveryDaysMin!==null&&item.deliveryDaysMax!==null&&<span className="flex items-center gap-2"><Truck className="text-[#d4f44d]" size={18}/>Seller estimate: {item.deliveryDaysMin}–{item.deliveryDaysMax} working days</span>}
      <span className="flex items-center gap-2"><Truck className="text-[#d4f44d]" size={18}/>Stock and dispatch supplied by the seller</span>
    </div><Link href={user?reportHref:`/account?returnTo=${encodeURIComponent(reportHref)}`} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#63706a] underline"><Flag size={14}/>Report this listing</Link>
   </div>
  </div>
 </main></>;
}
