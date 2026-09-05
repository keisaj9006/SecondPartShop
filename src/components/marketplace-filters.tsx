import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { MarketplaceFilters } from "@/lib/types";

export function MarketplaceFiltersPanel({filters}:{filters:MarketplaceFilters}){
 const input="w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#173c31]";
 const preserved=new URLSearchParams();
 if(filters.query)preserved.set("q",filters.query);
 if(filters.category)preserved.set("category",filters.category);
 if(filters.sort)preserved.set("sort",filters.sort);
 if(filters.postcode)preserved.set("pc",filters.postcode);
 if(filters.collectionOnly)preserved.set("collection","1");
 if(filters.vehicle)preserved.set("vehicle",filters.vehicle);
 if(filters.vehicleRegistration)preserved.set("vr",filters.vehicleRegistration);
 if(filters.catalogueVariant)preserved.set("cv",filters.catalogueVariant);
 if(filters.catalogueYear!==undefined)preserved.set("cy",String(filters.catalogueYear));
 if(filters.catalogueFuel)preserved.set("cf",filters.catalogueFuel);
 if(filters.catalogueEngineSize!==undefined)preserved.set("ce",String(filters.catalogueEngineSize));
 const resetHref="/"+(preserved.toString()?"?"+preserved.toString():"")+"#marketplace";
 const advancedActive=Boolean(Number.isFinite(filters.minPrice)||Number.isFinite(filters.maxPrice)||filters.collectionOnly);
 return <form method="get" action="/" className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
  {filters.query&&<input type="hidden" name="q" value={filters.query}/>}
  {filters.category&&<input type="hidden" name="category" value={filters.category}/>}
  {filters.postcode&&<input type="hidden" name="pc" value={filters.postcode}/>}
  {filters.vehicle&&<input type="hidden" name="vehicle" value={filters.vehicle}/>}
  {filters.vehicleRegistration&&<input type="hidden" name="vr" value={filters.vehicleRegistration}/>}
  {filters.catalogueVariant&&<input type="hidden" name="cv" value={filters.catalogueVariant}/>}
  {filters.catalogueYear!==undefined&&<input type="hidden" name="cy" value={filters.catalogueYear}/>}
  {filters.catalogueFuel&&<input type="hidden" name="cf" value={filters.catalogueFuel}/>}
  {filters.catalogueEngineSize!==undefined&&<input type="hidden" name="ce" value={filters.catalogueEngineSize}/>}

  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
   <label className="text-xs font-black uppercase tracking-[.08em] text-[#63706a]">Sort<select name="sort" defaultValue={filters.sort??"best"} className={"mt-1.5 "+input}><option value="best">Best match</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="distance">Nearest first</option><option value="delivery">Fastest delivery</option><option value="warranty">Longest warranty</option></select></label>
   <label className="text-xs font-black uppercase tracking-[.08em] text-[#63706a]">Condition<select name="condition" defaultValue={filters.condition??""} className={"mt-1.5 "+input}><option value="">Any condition</option><option value="new">New</option><option value="reconditioned">Reconditioned</option><option value="used">Used</option></select></label>
   <button className="self-end rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Apply</button>
   <Link href={resetHref} className="grid self-end place-items-center rounded-xl border border-black/12 px-5 py-3 text-sm font-bold">Reset</Link>
  </div>

  <details open={advancedActive} className="mt-3 rounded-xl bg-[#f8f7f2]">
   <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-black"><SlidersHorizontal size={16}/>Price & collection</summary>
   <div className="grid gap-3 border-t border-black/8 p-3 sm:grid-cols-3">
    <input aria-label="Minimum price" type="number" min="0" step="1" name="min" defaultValue={filters.minPrice} className={input} placeholder="Min price £"/>
    <input aria-label="Maximum price" type="number" min="0" step="1" name="max" defaultValue={filters.maxPrice} className={input} placeholder="Max price £"/>
    <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-bold"><input type="checkbox" name="collection" value="1" defaultChecked={filters.collectionOnly}/>Collection only</label>
   </div>
  </details>
 </form>;
}