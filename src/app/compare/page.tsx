import Link from "next/link";
import { ArrowLeft,GitCompareArrows } from "lucide-react";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getCurrentUser } from "@/lib/auth";
import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { getListings,getSavedPartIds } from "@/lib/data/marketplace";
import { enrichListingsWithDistance,normalizePostcode } from "@/lib/postcode";
import { normalizeComparablePartNumber } from "@/lib/offer-groups";
import type { MarketplaceFilters } from "@/lib/types";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};

export default async function ComparePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const number=first(params.number)?.trim()??"";
 const kind=first(params.kind)==="part"?"part":"oem";
 const manufacturer=first(params.manufacturer)?.trim()??"";
 if(!number)return <><Header/><main className="mx-auto max-w-4xl px-4 py-16 sm:px-6"><h1 className="text-3xl font-black">Nothing to compare</h1><p className="mt-2 text-[#63706a]">Choose a grouped part from marketplace results first.</p><Link href="/#marketplace" className="mt-5 inline-block font-bold underline">Back to marketplace</Link></main></>;

 const requestedVariant=first(params.cv);
 const requestedYear=integer(first(params.cy));
 const requestedFuel=first(params.cf);
 const requestedEngine=integer(first(params.ce));
 const selectedCatalogue=requestedVariant&&requestedYear?await getCatalogueSelection(requestedVariant,requestedYear,requestedFuel,requestedEngine):null;
 const postcodeRaw=first(params.pc);
 const filters:MarketplaceFilters={
  query:number,
  postcode:postcodeRaw?normalizePostcode(postcodeRaw):undefined,
  vehicle:first(params.vehicle),
  vehicleRegistration:first(params.vr),
  catalogueVariant:selectedCatalogue?.variantId,
  catalogueYear:selectedCatalogue?.year,
  catalogueFuel:selectedCatalogue?.fuelType??undefined,
  catalogueEngineSize:selectedCatalogue?.engineSizeSimple??undefined
 };
 const [result,user]=await Promise.all([getListings(filters),getCurrentUser()]);
 const expected=normalizeComparablePartNumber(number);
 const exact=result.data.filter(item=>normalizeComparablePartNumber(kind==="oem"?item.oemNumber??"":item.partNumber??"")===expected&&(kind==="oem"||!manufacturer||(item.manufacturer??"").toLowerCase()===manufacturer.toLowerCase()));
 const listings=await enrichListingsWithDistance(exact,filters.postcode);
 const savedIds=user?await getSavedPartIds(user.id):[];
 listings.sort((a,b)=>a.pricePence-b.pricePence);

 const preserved=new URLSearchParams();
 for(const key of ["pc","vehicle","vr","cv","cy","cf","ce"] as const){const value=first(params[key]);if(value)preserved.set(key,value);}
 const contextQuery=preserved.toString();
 const sellerCount=new Set(listings.map(item=>item.sellerId)).size;
 const cheapest=listings[0];
 const cheapestText=cheapest?" · from £"+(cheapest.pricePence/100).toLocaleString("en-GB",{minimumFractionDigits:2}):"";
 const backHref="/"+(preserved.toString()?"?"+preserved.toString():"")+"#marketplace";

 return <><Header/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
  <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft size={16}/>Back to marketplace</Link>
  <div className="mt-6 rounded-3xl bg-[#173c31] p-6 text-white sm:p-8">
   <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#d4f44d]"><GitCompareArrows size={16}/>Compare offers</p>
   <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">{kind==="oem"?"OE/OEM":"Part"} {number}</h1>
   <p className="mt-2 text-white/70">{listings.length} offer{listings.length===1?"":"s"} from {sellerCount} seller{sellerCount===1?"":"s"}{cheapestText}.</p>
  </div>

  {result.error&&<div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{result.error}</div>}
  {listings.length?<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map(item=><ProductCard key={item.id} item={item} saved={savedIds.includes(item.id)} contextQuery={contextQuery}/>)}</div>:!result.error&&<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white p-12 text-center"><h2 className="text-xl font-black">No exact offers available</h2><p className="mt-2 text-[#63706a]">The grouped result changed or no longer matches this exact number and vehicle context.</p></div>}
 </main></>;
}