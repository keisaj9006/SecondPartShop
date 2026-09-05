import Link from "next/link";
import { SearchX } from "lucide-react";
import { createPartRequest } from "@/app/requests/actions";
import type { MarketplaceFilters } from "@/lib/types";

export function PartRequestCard({signedIn,filters,defaultText=""}:{signedIn:boolean;filters:MarketplaceFilters;defaultText?:string}){
 return <section className="mx-auto mt-6 max-w-2xl rounded-3xl border border-black/10 bg-[#f8f7f2] p-5 text-left">
  <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173c31] text-[#d4f44d]"><SearchX size={18}/></span><div><h4 className="font-black">Can't find the exact part?</h4><p className="mt-1 text-sm leading-6 text-[#63706a]">Save a part request with your selected vehicle. You will not need to rebuild the search later.</p></div></div>
  {signedIn?<form action={createPartRequest} className="mt-4 grid gap-3">
   {filters.category&&<input type="hidden" name="categoryId" value={filters.category}/>}
   {filters.catalogueVariant&&<input type="hidden" name="variantId" value={filters.catalogueVariant}/>}
   {filters.catalogueYear!==undefined&&<input type="hidden" name="year" value={filters.catalogueYear}/>}
   {filters.catalogueFuel&&<input type="hidden" name="fuel" value={filters.catalogueFuel}/>}
   {filters.catalogueEngineSize!==undefined&&<input type="hidden" name="engine" value={filters.catalogueEngineSize}/>}
   {filters.vehicleRegistration&&<input type="hidden" name="registration" value={filters.vehicleRegistration}/>}
   <label className="text-sm font-bold">Part needed<input name="queryText" required minLength={3} maxLength={160} defaultValue={defaultText} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="e.g. front right LED headlight"/></label>
   <label className="text-sm font-bold">OE/OEM number <span className="font-normal text-[#63706a]">(optional)</span><input name="oemNumber" maxLength={80} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="If you know it"/></label>
   <label className="text-sm font-bold">Extra details <span className="font-normal text-[#63706a]">(optional)</span><textarea name="notes" maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Side, colour, connectors, visible markings or anything that helps identify the part."/></label>
   <button className="rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Save this part request</button>
  </form>:<div className="mt-4"><Link href="/account?returnTo=%2F%23marketplace" className="inline-block rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Sign in to save a request</Link></div>}
 </section>;
}
