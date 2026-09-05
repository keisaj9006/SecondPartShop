import Link from "next/link";
import { BadgeCheck,CarFront,Check,Search,ShieldCheck,Sparkles,Truck } from "lucide-react";
import { saveGarageVehicle } from "@/app/garage/actions";
import type { Category,GarageVehicle,Listing,MarketplaceFilters,Vehicle,VehicleCatalogueModelOption,VehicleCatalogueSelection } from "@/lib/types";
import { ProductCard } from "./product-card";
import { VehicleSelector } from "./vehicle-selector";
import { MarketplaceFiltersPanel } from "./marketplace-filters";
import { MarketplaceSearch } from "./marketplace-search";
import { PartRequestCard } from "./part-request-card";
import { PostcodeDistanceFilter } from "./postcode-distance-filter";
import { OfferGroupCard } from "./offer-group-card";
import { groupListingsForOffers } from "@/lib/offer-groups";

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
 if(filters.catalogueVariant)params.set("cv",filters.catalogueVariant);
 if(filters.catalogueYear!==undefined)params.set("cy",String(filters.catalogueYear));
 if(filters.catalogueFuel)params.set("cf",filters.catalogueFuel);
 if(filters.catalogueEngineSize!==undefined)params.set("ce",String(filters.catalogueEngineSize));
 return params;
};

const savedVehicleHref=(vehicle:GarageVehicle,baseParams:Record<string,string>)=>{
 const params=new URLSearchParams(baseParams);
 params.set("cv",vehicle.catalogueVariantId);
 params.set("cy",String(vehicle.year));
 if(vehicle.fuelType)params.set("cf",vehicle.fuelType);else params.delete("cf");
 if(vehicle.engineSizeSimple!==null)params.set("ce",String(vehicle.engineSizeSimple));else params.delete("ce");
 if(vehicle.registration)params.set("vr",vehicle.registration);else params.delete("vr");
 params.delete("vehicle");
 return `/?${params.toString()}#marketplace`;
};

export function MarketplaceHome({listings,categories,vehicles,catalogueModels,garageVehicles,signedIn,filters,selectedCatalogue,savedIds,error,configured}:{listings:Listing[];categories:Category[];vehicles:Vehicle[];catalogueModels:VehicleCatalogueModelOption[];garageVehicles:GarageVehicle[];signedIn:boolean;filters:MarketplaceFilters;selectedCatalogue:VehicleCatalogueSelection|null;savedIds:string[];error:string|null;configured:boolean}){
 const selectedLegacy=vehicles.find(v=>v.id===filters.vehicle);
 const selectedCategory=categories.find(category=>category.id===filters.category);
 const baseParams=Object.fromEntries(Object.entries({q:filters.query,category:filters.category,condition:filters.condition,sort:filters.sort,min:filters.minPrice?.toString(),max:filters.maxPrice?.toString()}).filter((entry):entry is [string,string]=>Boolean(entry[1])));
 const activeVehicleLabel=selectedCatalogue
  ?`${selectedCatalogue.make} ${selectedCatalogue.modelFamily} ${selectedCatalogue.year}`
  :selectedLegacy?`${selectedLegacy.make} ${selectedLegacy.model} ${selectedLegacy.year}`:undefined;
 const contextQuery=vehicleParams(filters).toString();
 const offerGroups=groupListingsForOffers(listings);
 const selectedSaved=Boolean(selectedCatalogue&&garageVehicles.some(vehicle=>
  vehicle.catalogueVariantId===selectedCatalogue.variantId&&
  vehicle.year===selectedCatalogue.year&&
  (vehicle.fuelType??null)===(selectedCatalogue.fuelType??null)&&
  (vehicle.engineSizeSimple??null)===(selectedCatalogue.engineSizeSimple??null)&&
  (!filters.vehicleRegistration||vehicle.registration===filters.vehicleRegistration)
 ));

 return <main>
  <section className="dot-grid overflow-hidden bg-[#173c31] text-white">
   <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:py-20">
    <div className="animate-in">
     <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold text-[#d4f44d]"><Sparkles size={14}/>Smarter parts search for UK drivers</div>
     <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.055em] sm:text-6xl">The right part.<br/><span className="text-[#d4f44d]">First time.</span></h1>
     <p className="mt-6 max-w-xl text-lg leading-7 text-white/72">Identify your vehicle, then search by part name, OE/OEM number, category, brand or keyword.</p>
     <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/75"><span className="flex items-center gap-2"><BadgeCheck size={18} className="text-[#d4f44d]"/>Verified garages</span><span className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#d4f44d]"/>Evidence-based fitment</span><span className="flex items-center gap-2"><Truck size={18} className="text-[#d4f44d]"/>UK-wide sellers</span></div>
    </div>

    <div className="animate-in rounded-[28px] bg-[#f5f2ea] p-5 text-[#12221d] shadow-2xl [animation-delay:120ms] sm:p-7">
     <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black">Find parts compatible with your vehicle</p><p className="mb-4 mt-1 text-sm text-[#63706a]">Enter your registration first, or select the vehicle manually if you do not know it.</p></div>{signedIn&&<Link href="/garage" className="text-xs font-black underline">Manage Garage</Link>}</div>

     {garageVehicles.length>0&&<div className="mb-4 rounded-2xl border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#287154]"><CarFront size={15}/>Your Garage</p><Link href="/garage" className="text-xs font-bold underline">View all</Link></div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{garageVehicles.slice(0,4).map(vehicle=><Link key={vehicle.id} href={savedVehicleHref(vehicle,baseParams)} className="min-w-fit rounded-xl border border-black/10 bg-[#f8f7f2] px-3 py-2 text-xs font-bold hover:bg-[#eef1eb]">{vehicle.registration?<span className="mr-2 font-mono text-[#287154]">{vehicle.registration}</span>:null}{vehicle.make} {vehicle.modelFamily} · {vehicle.year}</Link>)}</div>
     </div>}

     <VehicleSelector vehicles={vehicles} catalogueModels={catalogueModels} selectedId={filters.vehicle} selectedCatalogue={selectedCatalogue} baseParams={baseParams}/>

     {selectedCatalogue&&<div className="mt-4 flex flex-wrap items-center gap-3 border-t border-black/10 pt-4">
      {selectedSaved?<><span className="inline-flex items-center gap-2 text-sm font-black text-[#287154]"><Check size={16}/>Saved in your Garage</span><Link href="/garage" className="text-xs font-bold underline">Manage</Link></>:signedIn?<form action={saveGarageVehicle}>
       <input type="hidden" name="variantId" value={selectedCatalogue.variantId}/>
       <input type="hidden" name="year" value={selectedCatalogue.year}/>
       {selectedCatalogue.fuelType&&<input type="hidden" name="fuel" value={selectedCatalogue.fuelType}/>}
       {selectedCatalogue.engineSizeSimple!==null&&<input type="hidden" name="engine" value={selectedCatalogue.engineSizeSimple}/>}
       {filters.vehicleRegistration&&<input type="hidden" name="registration" value={filters.vehicleRegistration}/>}
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
   <p className="mt-6 text-[#63706a]">{offerGroups.length===listings.length?`${listings.length} listing${listings.length===1?"":"s"} match the current search`:`${offerGroups.length} results · ${listings.length} seller offers`}</p>
   {error&&<div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm"><p className="font-bold">{configured?"Marketplace data is temporarily unavailable":"Supabase setup required"}</p><p className="mt-1 text-amber-900/75">{error}</p></div>}
   {listings.length?<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{offerGroups.map(group=>group.listings.length>1?<OfferGroupCard key={group.key} group={group} contextQuery={contextQuery}/>:<ProductCard key={group.listings[0].id} item={group.listings[0]} saved={savedIds.includes(group.listings[0].id)} contextQuery={contextQuery}/>)}</div>:!error&&<><div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white py-16 text-center"><Search className="mx-auto mb-4 text-[#63706a]"/><h3 className="text-xl font-bold">No confirmed matches yet</h3><p className="mx-auto mt-2 max-w-xl text-[#63706a]">{activeVehicleLabel?"We know which vehicle you selected, but no seller fitment currently confirms a matching part for this search. We will never label an unverified part as a confirmed fit.":"Try a different part name, category, OE/OEM number or filter."}</p></div><PartRequestCard signedIn={signedIn} filters={filters} defaultText={filters.query??selectedCategory?.name??""}/></>}
  </section>
 </main>;
}
