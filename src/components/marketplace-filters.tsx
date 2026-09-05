import Link from "next/link";
import type { MarketplaceFilters } from "@/lib/types";

export function MarketplaceFiltersPanel({filters}:{filters:MarketplaceFilters}){
 const input="rounded-xl border border-black/12 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#173c31]";
 const preserved=new URLSearchParams();
 if(filters.query)preserved.set("q",filters.query);
 if(filters.category)preserved.set("category",filters.category);
 if(filters.vehicle)preserved.set("vehicle",filters.vehicle);
 if(filters.catalogueVariant)preserved.set("cv",filters.catalogueVariant);
 if(filters.catalogueYear!==undefined)preserved.set("cy",String(filters.catalogueYear));
 if(filters.catalogueFuel)preserved.set("cf",filters.catalogueFuel);
 if(filters.catalogueEngineSize!==undefined)preserved.set("ce",String(filters.catalogueEngineSize));
 const resetHref=`/${preserved.toString()?`?${preserved.toString()}`:""}#marketplace`;
 return <form method="get" action="/" className="mt-4 grid gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
  {filters.query&&<input type="hidden" name="q" value={filters.query}/>}
  {filters.category&&<input type="hidden" name="category" value={filters.category}/>}
  {filters.vehicle&&<input type="hidden" name="vehicle" value={filters.vehicle}/>}
  {filters.catalogueVariant&&<input type="hidden" name="cv" value={filters.catalogueVariant}/>}
  {filters.catalogueYear!==undefined&&<input type="hidden" name="cy" value={filters.catalogueYear}/>}
  {filters.catalogueFuel&&<input type="hidden" name="cf" value={filters.catalogueFuel}/>}
  {filters.catalogueEngineSize!==undefined&&<input type="hidden" name="ce" value={filters.catalogueEngineSize}/>}
  <select name="condition" defaultValue={filters.condition??""} className={input}><option value="">Any condition</option><option value="new">New</option><option value="reconditioned">Reconditioned</option><option value="used">Used</option></select>
  <input type="number" min="0" step="1" name="min" defaultValue={filters.minPrice} className={input} placeholder="Min price £"/>
  <input type="number" min="0" step="1" name="max" defaultValue={filters.maxPrice} className={input} placeholder="Max price £"/>
  <button className="rounded-xl bg-[#173c31] px-5 py-2.5 text-sm font-black text-white">Apply filters</button>
  <Link href={resetHref} className="grid place-items-center rounded-xl border border-black/12 px-5 py-2.5 text-sm font-bold">Reset price & condition</Link>
 </form>;
}
