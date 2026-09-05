import { Header } from "@/components/header";
import { MarketplaceHome } from "@/components/marketplace-home";
import { getCategories,getListings,getSavedPartIds,getVehicles } from "@/lib/data/marketplace";
import { getGarageVehicles } from "@/lib/data/garage";
import { getRecentlyViewedListings } from "@/lib/data/buyer-account";
import { getCatalogueModelMap,getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { getCurrentUser } from "@/lib/auth";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import { enrichListingsWithDistance,normalizePostcode } from "@/lib/postcode";
import type { MarketplaceFilters,MarketplaceSort,PartCondition } from "@/lib/types";
import { sortMarketplaceListings } from "@/lib/marketplace-sort";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const condition=first(params.condition);
 const requestedSort=first(params.sort);
 const sort=(["best","price_asc","price_desc","distance","delivery","warranty"] as string[]).includes(requestedSort??"")?requestedSort as MarketplaceSort:"best";
 const requestedCatalogueVariant=first(params.cv);
 const requestedCatalogueYear=integer(first(params.cy));
 const requestedCatalogueFuel=first(params.cf);
 const requestedCatalogueEngine=integer(first(params.ce));
 const rawRegistration=first(params.vr);
 const vehicleRegistration=rawRegistration?normalizeRegistration(rawRegistration):undefined;
 const rawPostcode=first(params.pc);
 const postcode=rawPostcode?normalizePostcode(rawPostcode):undefined;
 const [categories,user]=await Promise.all([getCategories(),getCurrentUser()]);
 const selectedCatalogue=requestedCatalogueVariant&&requestedCatalogueYear
  ?await getCatalogueSelection(requestedCatalogueVariant,requestedCatalogueYear,requestedCatalogueFuel,requestedCatalogueEngine)
  :null;
 const filters:MarketplaceFilters={
  query:first(params.q),
  category:first(params.category),
  condition:(["new","reconditioned","used"] as string[]).includes(condition??"")?condition as PartCondition:undefined,
  sort,
  minPrice:first(params.min)?Number(first(params.min)):undefined,
  maxPrice:first(params.max)?Number(first(params.max)):undefined,
  postcode,
  collectionOnly:first(params.collection)==="1",
  vehicle:first(params.vehicle),
  vehicleRegistration:vehicleRegistration||undefined,
  catalogueVariant:selectedCatalogue?.variantId,
  catalogueYear:selectedCatalogue?.year,
  catalogueFuel:selectedCatalogue?.fuelType??undefined,
  catalogueEngineSize:selectedCatalogue?.engineSizeSimple??undefined
 };
 const [result,vehicles,savedIds,catalogueModels,garageVehicles,recentlyViewed]=await Promise.all([
  getListings(filters),
  getVehicles(),
  user?getSavedPartIds(user.id):Promise.resolve([]),
  getCatalogueModelMap(),
  user?getGarageVehicles(user.id):Promise.resolve([]),
  user?getRecentlyViewedListings(user.id,3):Promise.resolve([])
 ]);
 const listingsWithDistance=await enrichListingsWithDistance(result.data,postcode);
 const sortedListings=sortMarketplaceListings(listingsWithDistance,sort);
 return <><Header/><MarketplaceHome listings={sortedListings} categories={categories} vehicles={vehicles} catalogueModels={catalogueModels} garageVehicles={garageVehicles} recentlyViewed={recentlyViewed} signedIn={Boolean(user)} filters={filters} selectedCatalogue={selectedCatalogue} savedIds={savedIds} error={result.error} configured={result.configured}/><footer className="border-t border-black/10 px-4 py-8 text-sm text-[#63706a]"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row"><span>© 2026 SecondPart Ltd.</span><span>Built for the UK automotive trade.</span></div></footer></>;
}
