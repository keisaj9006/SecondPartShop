import Link from "next/link";
import { BadgeCheck,CarFront,Check,Search,ShieldCheck,Sparkles,Truck } from "lucide-react";
import { saveGarageVehicle } from "@/app/garage/actions";
import type { Category,GarageVehicle,Listing,MarketplaceFilters,Vehicle,VehicleCatalogueSelection } from "@/lib/types";
import { ProductCard } from "./product-card";
import { VehicleSelector } from "./vehicle-selector";
import { VehicleVisual } from "./vehicle-visual";
import { MarketplaceFiltersPanel } from "./marketplace-filters";
import { MarketplaceSearch } from "./marketplace-search";
import { PartRequestCard } from "./part-request-card";
import { PostcodeDistanceFilter } from "./postcode-distance-filter";
import { OfferGroupCard } from "./offer-group-card";
import { groupListingsForOffers } from "@/lib/offer-groups";
import { SaveSearchControl } from "./save-search-control";
import { VehicleCompatibilityToggle } from "./vehicle-compatibility-toggle";
import { VehicleContextPersistence } from "./vehicle-context-persistence";

const vehicleParams=(filters:MarketplaceFilters)=>{
 const params=new URLSearchParams();
 if(filters.query)params.set("q",filters.query);
 if(filters.category)params.set("category",filters.category);
 if(filters.condition)params.set("condition",filters.condition);
 if(filters.sort)params.set("sort",filters.sort);
 if(filters.postcode)params.set("pc",filters.postcode);
 if(filters.collectionOnly)params.set("collection","1");
 if(Number.isFinite(filters.minPrice))params.set("min",String(filters.minPrice));
 if(Number.isFinite(filters.maxPrice))params.set("max",String(filters.maxPrice));
 if(filters.vehicle)params.set("vehicle",filters.vehicle);
 if(filters.vehicleRegistration)params.set("vr",filters.vehicleRegistration);
 if(filters.vehicleColour)params.set("vc",filters.vehicleColour);
 if(filters.catalogueVariant)params.set("cv",filters.catalogueVariant);
 if(filters.catalogueYear!==undefined)params.set("cy",String(filters.catalogueYear));
 if(filters.catalogueFuel)params.set("cf",filters.catalogueFuel);
 if(filters.catalogueEngineSize!==undefined)params.set("ce",String(filters.catalogueEngineSize));
 if((filters.vehicle||filters.catalogueVariant)&&filters.compatibleOnly===false)params.set("fit","0");
 return params;
};

const savedVehicleHref=(vehicle:GarageVehicle,baseParams:Record<string,string>)=>{
 const params=new URLSearchParams(baseParams);
 params.set("cv",vehicle.catalogueVariantId);
 params.set("cy",String(vehicle.year));
 if(vehicle.fuelType)params.set("cf",vehicle.fuelType);else params.delete("cf");
 if(vehicle.engineSizeSimple!==null)params.set("ce",String(vehicle.engineSizeSimple));else params.delete("ce");
 if(vehicle.registration)params.set("vr",vehicle.registration);else params.delete("vr");
 if(vehicle.colour)params.set("vc",vehicle.colour);else params.delete("vc");
 params.delete("vehicle");
 return `/?${params.toString()}#marketplace`;
};

export function MarketplaceHome({listings,categories,vehicles,garageVehicles,recentlyViewed,signedIn,filters,selectedCatalogue,savedIds,error,configured,pagination,currentPage,freshVehicleSelection=false}:{listings:Listing[];categories:Category[];vehicles:Vehicle[];garageVehicles:GarageVehicle[];recentlyViewed:Listing[];signedIn:boolean;filters:MarketplaceFilters;selectedCatalogue:VehicleCatalogueSelection|null;savedIds:string[];error:string|null;configured:boolean;pagination:{offset:number;limit:number;returned:number;total:number|null;hasMore:boolean;mode:"offset"|"cursor";nextCursor:string|null};currentPage:number;freshVehicleSelection?:boolean}){
 const selectedLegacy=vehicles.find(v=>v.id===filters.vehicle);
 const selectedCategory=categories.find(category=>category.id===filters.category);
 const hasActiveVehicle=Boolean(selectedCatalogue||selectedLegacy);
 const baseParams=Object.fromEntries(Object.entries({q:filters.query,category:filters.category,condition:filters.condition,sort:filters.sort,min:filters.minPrice?.toString(),max:filters.maxPrice?.toString(),pc:filters.postcode,collection:filters.collectionOnly?"1":undefined,fit:hasActiveVehicle&&filters.compatibleOnly===false?"0":undefined}).filter((entry):entry is [string,string]=>Boolean(entry[1])));
 const activeVehicleLabel=selectedCatalogue
  ?`${filters.vehicleRegistration?`${filters.vehicleRegistration} · `:""}${selectedCatalogue.make} ${selectedCatalogue.modelFamily} ${selectedCatalogue.year}${filters.vehicleColour?` · ${filters.vehicleColour}`:""}`
  :selectedLegacy?`${selectedLegacy.make} ${selectedLegacy.model} ${selectedLegacy.year}`:undefined;
 const contextParams=vehicleParams(filters);
 if(currentPage>1)contextParams.set("page",String(currentPage));
 const contextQuery=contextParams.toString();
 const pageHref=(page:number)=>{
  const params=vehicleParams(filters);
  if(page>1)params.set("page",String(page));else params.delete("page");
  params.delete("cursor");
  const query=params.toString();
  return query?"/?"+query+"#marketplace":"/#marketplace";
 };
 const cursorHref=(cursor:string)=>{
  const params=vehicleParams(filters);
  params.delete("page");
  params.set("cursor",cursor);
  const query=params.toString();
  return query?"/?"+query+"#marketplace":"/#marketplace";
 };
 const offerGroups=groupListingsForOffers(listings);
 const selectedSaved=Boolean(selectedCatalogue&&garageVehicles.some(vehicle=>
  vehicle.catalogueVariantId===selectedCatalogue.variantId&&
  vehicle.year===selectedCatalogue.year&&
  (vehicle.fuelType??null)===(selectedCatalogue.fuelType??null)&&
  (vehicle.engineSizeSimple??null)===(selectedCatalogue.engineSizeSimple??null)&&
  (!filters.vehicleRegistration||vehicle.registration===filters.vehicleRegistration)
 ));

 return <main>
  <VehicleContextPersistence/>
  <section className="dot-grid overflow-hidden bg-[#173c31] text-white">
   <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-14 lg:grid-cols-[.9fr_1.1fr] lg:py-20">
    <div className="animate-in">
     <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold text-[#d4f44d]"><Sparkles size={14}/>Smarter parts search for UK drivers</div>
     <h1 className="max-w-3xl text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-6xl">The right part.<br/><span className="text-[#d4f44d]">First time.</span></h1>
     <p className="mt-6 max-w-xl text-lg leading-7 text-white/72">Identify your vehicle, then search by part name, OE/OEM number, category, brand or keyword.</p>
     <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/75"><span className="flex items-center gap-2"><BadgeCheck size={18} className="text-[#d4f44d]"/>Verified garages</span><span className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#d4f44d]"/>Evidence-based fitment</span><span className="flex items-center gap-2"><Truck size={18} className="text-[#d4f44d]"/>UK-wide sellers</span></div>
    </div>

    <div id="vehicle-picker" className="animate-in min-w-0 scroll-mt-6 rounded-[24px] bg-[#f5f2ea] p-4 text-[#12221d] shadow-2xl [animation-delay:120ms] sm:rounded-[28px] sm:p-7">
     <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black">{freshVehicleSelection?"Add another vehicle":"Find parts compatible with your vehicle"}</p><p className="mb-4 mt-1 text-sm text-[#63706a]">{freshVehicleSelection?"Start with a clean vehicle selection. Your previously used vehicle will not be pre-filled.":"Enter your registration first, or select the vehicle manually if you do not know it."}</p></div>{signedIn&&<Link href="/garage" className="text-xs font-black underline">Manage Garage</Link>}</div>

     {garageVehicles.length>0&&!freshVehicleSelection&&<div className="mb-4 rounded-2xl border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#287154]"><CarFront size={15}/>Your Garage</p><Link href="/garage" className="text-xs font-bold underline">View all</Link></div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{garageVehicles.slice(0,4).map(vehicle=><Link key={vehicle.id} href={savedVehicleHref(vehicle,baseParams)} className="min-w-fit rounded-xl border border-black/10 bg-[#f8f7f2] px-3 py-2 text-xs font-bold hover:bg-[#eef1eb]">{vehicle.registration?<span className="mr-2 font-mono text-[#287154]">{vehicle.registration}</span>:null}{vehicle.make} {vehicle.modelFamily} · {vehicle.year}</Link>)}</div>
     </div>}

     <VehicleSelector key={`${freshVehicleSelection?"fresh":selectedCatalogue?.variantId??filters.vehicle??"none"}-${selectedCatalogue?.year??"none"}-${hasActiveVehicle&&filters.compatibleOnly===false?"all":"fit"}`} vehicles={vehicles} selectedId={freshVehicleSelection?undefined:filters.vehicle} selectedCatalogue={freshVehicleSelection?null:selectedCatalogue} baseParams={baseParams} compatibleOnly={hasActiveVehicle?filters.compatibleOnly!==false:true} freshSelection={freshVehicleSelection}/>

     {selectedCatalogue&&<div className="mt-4 grid gap-3">
      <VehicleVisual make={selectedCatalogue.make} model={selectedCatalogue.modelFamily} year={selectedCatalogue.year} colour={filters.vehicleColour} variant={selectedCatalogue.variant} registration={filters.vehicleRegistration} engine={selectedCatalogue.engineSizeSimple?selectedCatalogue.engineSizeSimple+"cc":null} fuel={selectedCatalogue.fuelType}/>
      <VehicleCompatibilityToggle vehicleLabel={activeVehicleLabel??`${selectedCatalogue.make} ${selectedCatalogue.modelFamily} ${selectedCatalogue.year}`} checked={filters.compatibleOnly!==false}/>
     </div>}

     {selectedCatalogue&&<div className="mt-4 flex flex-wrap items-center gap-3 border-t border-black/10 pt-4">
      {selectedSaved?<><span className="inline-flex items-center gap-2 text-sm font-black text-[#287154]"><Check size={16}/>Saved in your Garage</span><Link href="/garage" className="text-xs font-bold underline">Manage</Link></>:signedIn?<form action={saveGarageVehicle}>
       <input type="hidden" name="variantId" value={selectedCatalogue.variantId}/>
       <input type="hidden" name="year" value={selectedCatalogue.year}/>
       {selectedCatalogue.fuelType&&<input type="hidden" name="fuel" value={selectedCatalogue.fuelType}/>}
       {selectedCatalogue.engineSizeSimple!==null&&<input type="hidden" name="engine" value={selectedCatalogue.engineSizeSimple}/>}
       {filters.vehicleRegistration&&<input type="hidden" name="registration" value={filters.vehicleRegistration}/>}
       {filters.vehicleColour&&<input type="hidden" name="colour" value={filters.vehicleColour}/>}
       <button className="rounded-full border border-[#173c31]/20 bg-white px-4 py-2 text-sm font-black">+ Save this vehicle to Garage</button>
      </form>:<Link href="/account?returnTo=%2F" className="text-sm font-black underline">Sign in to save this vehicle</Link>}
     </div>}
    </div>
   </div>
  </section>

  <section id="marketplace" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
   <div className="mb-6"><p className="mb-2 text-xs font-black uppercase tracking-[.2em] text-[#287154]">Marketplace</p><h2 className="text-3xl font-black tracking-[-.04em] sm:text-4xl">Find the part you need</h2></div>
   <MarketplaceSearch categories={categories} filters={filters} activeVehicleLabel={activeVehicleLabel}/>
   <MarketplaceFiltersPanel filters={filters}/>
   <PostcodeDistanceFilter initialPostcode={filters.postcode}/>
   <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="text-[#63706a]">{pagination.total!==null?`${pagination.total.toLocaleString("en-GB")} listing${pagination.total===1?"":"s"} match the current search`:pagination.hasMore?`Showing ${pagination.returned} results · more available`:`${pagination.returned} listing${pagination.returned===1?"":"s"} match the current search`}</p><SaveSearchControl signedIn={signedIn} filters={filters}/></div>
   {error&&<div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm"><p className="font-bold">{configured?"Marketplace data is temporarily unavailable":"Supabase setup required"}</p><p className="mt-1 text-amber-900/75">{error}</p></div>}
   {listings.length?<><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{offerGroups.map(group=>group.listings.length>1?<OfferGroupCard key={group.key} group={group} contextQuery={contextQuery}/>:<ProductCard key={group.listings[0].id} item={group.listings[0]} saved={savedIds.includes(group.listings[0].id)} contextQuery={contextQuery}/>)}</div>{pagination.mode==="cursor"
 ?pagination.hasMore&&pagination.nextCursor&&<nav aria-label="Marketplace results" className="mt-10 flex items-center justify-center"><Link href={cursorHref(pagination.nextCursor)} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#173c31] px-6 py-2.5 text-sm font-black text-white">Next 24 parts</Link></nav>
 :(currentPage>1||pagination.hasMore)&&<nav aria-label="Marketplace pages" className="mt-10 flex items-center justify-center gap-3">{currentPage>1&&<Link href={pageHref(currentPage-1)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-black">Previous</Link>}<span className="px-2 text-sm font-bold text-[#63706a]">Page {currentPage}</span>{pagination.hasMore&&<Link href={pageHref(currentPage+1)} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#173c31] px-5 py-2.5 text-sm font-black text-white">Next</Link>}</nav>}</>:!error&&<><div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white py-16 text-center"><Search className="mx-auto mb-4 text-[#63706a]"/><h3 className="text-xl font-bold">{activeVehicleLabel&&filters.compatibleOnly!==false?"No compatible matches yet":"No marketplace matches yet"}</h3><p className="mx-auto mt-2 max-w-xl text-[#63706a]">{activeVehicleLabel&&filters.compatibleOnly!==false?"No seller evidence currently provides a confirmed or same-family compatibility match. Untick the vehicle-fit checkbox to browse all parts while keeping compatibility labels visible.":"Try a different part name, category, OE/OEM number or filter."}</p></div><PartRequestCard signedIn={signedIn} filters={filters} defaultText={filters.query??selectedCategory?.name??""}/></>}
  </section>
  {recentlyViewed.length>0&&<section className="border-t border-black/8 bg-[#f8f7f2]"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Continue browsing</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Recently viewed</h2></div><Link href="/recently-viewed" className="text-sm font-black underline">View all</Link></div><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recentlyViewed.map(item=><ProductCard key={item.id} item={item} saved={savedIds.includes(item.id)}/>)}</div></div></section>}
 </main>;
}
