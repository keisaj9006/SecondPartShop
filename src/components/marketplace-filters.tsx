import type { Category,MarketplaceFilters } from "@/lib/types";
import Link from "next/link";
export function MarketplaceFiltersPanel({filters,categories,families,codes}:{filters:MarketplaceFilters;categories:Category[];families:string[];codes:string[]}){
 const input="rounded-xl border border-black/12 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#173c31]";
 const selectedCategory=categories.find(c=>c.id===filters.category);
 const showTransmission=Boolean(selectedCategory?.isTransmissionRelated);
 return <form method="get" action="/" className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
  <input name="q" defaultValue={filters.query} className={`${input} sm:col-span-2`} placeholder="Title, OEM or part number"/>
  <select name="category" defaultValue={filters.category??""} className={input}><option value="">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
  <select name="condition" defaultValue={filters.condition??""} className={input}><option value="">Any condition</option><option value="new">New</option><option value="reconditioned">Reconditioned</option><option value="used">Used</option></select>
  {showTransmission&&<><select name="family" defaultValue={filters.gearboxFamily??""} className={input}><option value="">Any gearbox family</option>{families.map(v=><option key={v}>{v}</option>)}</select><select name="code" defaultValue={filters.gearboxCode??""} className={input}><option value="">Any gearbox code</option>{codes.map(v=><option key={v}>{v}</option>)}</select></>}
  <input type="number" min="0" step="1" name="min" defaultValue={filters.minPrice} className={input} placeholder="Min price £"/>
  <input type="number" min="0" step="1" name="max" defaultValue={filters.maxPrice} className={input} placeholder="Max price £"/>
  {filters.vehicle&&<input type="hidden" name="vehicle" value={filters.vehicle}/>}<button className="rounded-xl bg-[#173c31] px-5 py-2.5 text-sm font-black text-white">Apply filters</button><Link href="/#marketplace" className="grid place-items-center rounded-xl border border-black/12 px-5 py-2.5 text-sm font-bold">Clear</Link>
 </form>;
}
