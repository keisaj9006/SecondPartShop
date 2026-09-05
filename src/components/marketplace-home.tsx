import { BadgeCheck,Search,ShieldCheck,Sparkles,Truck } from "lucide-react";
import type { Category,Listing,MarketplaceFilters,Vehicle,VehicleCatalogueModelOption,VehicleCatalogueSelection } from "@/lib/types";
import { ProductCard } from "./product-card";
import { VehicleSelector } from "./vehicle-selector";
import { MarketplaceFiltersPanel } from "./marketplace-filters";
import { MarketplaceSearch } from "./marketplace-search";

export function MarketplaceHome({listings,categories,vehicles,catalogueModels,filters,selectedCatalogue,savedIds,error,configured}:{listings:Listing[];categories:Category[];vehicles:Vehicle[];catalogueModels:VehicleCatalogueModelOption[];filters:MarketplaceFilters;selectedCatalogue:VehicleCatalogueSelection|null;savedIds:string[];error:string|null;configured:boolean}){
 const selectedLegacy=vehicles.find(v=>v.id===filters.vehicle);
 const baseParams=Object.fromEntries(Object.entries({q:filters.query,category:filters.category,condition:filters.condition,min:filters.minPrice?.toString(),max:filters.maxPrice?.toString()}).filter((entry):entry is [string,string]=>Boolean(entry[1])));
 const activeVehicleLabel=selectedCatalogue
  ?`${selectedCatalogue.make} ${selectedCatalogue.modelFamily} ${selectedCatalogue.year}`
  :selectedLegacy?`${selectedLegacy.make} ${selectedLegacy.model} ${selectedLegacy.year}`:undefined;
 const vehicleActive=Boolean(filters.vehicle||filters.catalogueVariant);
 return <main>
  <section className="dot-grid overflow-hidden bg-[#173c31] text-white">
   <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:py-20">
    <div className="animate-in">
     <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold text-[#d4f44d]"><Sparkles size={14}/>Smarter parts search for UK drivers</div>
     <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.055em] sm:text-6xl">The right part.<br/><span className="text-[#d4f44d]">First time.</span></h1>
     <p className="mt-6 max-w-xl text-lg leading-7 text-white/72">Identify your vehicle, then search by part name, OE/OEM number, category, brand or keyword.</p>
     <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/75"><span className="flex items-center gap-2"><BadgeCheck size={18} className="text-[#d4f44d]"/>Verified garages</span><span className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#d4f44d]"/>Explicit fitment matching</span><span className="flex items-center gap-2"><Truck size={18} className="text-[#d4f44d]"/>UK-wide sellers</span></div>
    </div>
    <div className="animate-in rounded-[28px] bg-[#f5f2ea] p-5 text-[#12221d] shadow-2xl [animation-delay:120ms] sm:p-7">
     <p className="text-sm font-black">Find parts compatible with your vehicle</p>
     <p className="mb-4 mt-1 text-sm text-[#63706a]">Enter your registration first, or select the vehicle manually if you do not know it.</p>
     <VehicleSelector vehicles={vehicles} catalogueModels={catalogueModels} selectedId={filters.vehicle} selectedCatalogue={selectedCatalogue} baseParams={baseParams}/>
    </div>
   </div>
  </section>

  <section id="marketplace" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
   <div className="mb-6"><p className="mb-2 text-xs font-black uppercase tracking-[.2em] text-[#287154]">Marketplace</p><h2 className="text-3xl font-black tracking-[-.04em] sm:text-4xl">Find the part you need</h2></div>
   <MarketplaceSearch categories={categories} filters={filters} activeVehicleLabel={activeVehicleLabel}/>
   <MarketplaceFiltersPanel filters={filters}/>
   <p className="mt-6 text-[#63706a]">{listings.length} listing{listings.length===1?"":"s"} match the current search</p>
   {error&&<div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm"><p className="font-bold">{configured?"Marketplace data is temporarily unavailable":"Supabase setup required"}</p><p className="mt-1 text-amber-900/75">{error}</p></div>}
   {listings.length?<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map(item=><ProductCard key={item.id} item={item} saved={savedIds.includes(item.id)} fitsVehicle={vehicleActive}/>)}</div>:!error&&<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white py-20 text-center"><Search className="mx-auto mb-4 text-[#63706a]"/><h3 className="text-xl font-bold">No matching parts</h3><p className="mx-auto mt-2 max-w-xl text-[#63706a]">{vehicleActive?"We found your vehicle, but no seller has linked a compatible part for this search yet.":"Try a different part name, category, OE/OEM number or filter."}</p></div>}
  </section>
 </main>;
}
