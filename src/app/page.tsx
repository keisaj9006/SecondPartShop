import { Header } from "@/components/header";
import { MarketplaceHome } from "@/components/marketplace-home";
import { getCategories,getMarketplacePage,getSavedPartIds,getVehicles } from "@/lib/data/marketplace";
import { getGarageVehicles } from "@/lib/data/garage";
import { getRecentlyViewedListings } from "@/lib/data/buyer-account";
import { getCatalogueModelMap,getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { getCurrentUser } from "@/lib/auth";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import { normalizePostcode } from "@/lib/postcode";
import type { MarketplaceFilters,MarketplaceSort,PartCondition } from "@/lib/types";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const condition=first(params.condition);
 const requestedSort=first(params.sort);
 const sort=(["best","price_asc","price_desc","distance","delivery","warranty"] as string[]).includes(requestedSort??"")?requestedSort as MarketplaceSort:"best";
 const legacyVehicleId=isUuid(first(params.vehicle))?first(params.vehicle):undefined;
 const requestedCatalogueVariant=isUuid(first(params.cv))?first(params.cv):undefined;
 const requestedCatalogueYear=integer(first(params.cy));
 const requestedCatalogueFuel=first(params.cf);
 const requestedCatalogueEngine=integer(first(params.ce));
 const requestedPage=Math.max(1,integer(first(params.page))??1);
 const pageSize=24;
 const rawRegistration=first(params.vr);
 const vehicleRegistration=rawRegistration?normalizeRegistration(rawRegistration):undefined;
 const vehicleColour=first(params.vc)?.trim().slice(0,40)||undefined;
 const rawPostcode=first(params.pc);
 const postcode=rawPostcode?normalizePostcode(rawPostcode):undefined;
 const selectedCataloguePromise=requestedCatalogueVariant&&requestedCatalogueYear
  ?getCatalogueSelection(requestedCatalogueVariant,requestedCatalogueYear,requestedCatalogueFuel,requestedCatalogueEngine).catch(()=>null)
  :Promise.resolve(null);
 const [categories,user,selectedCatalogue]=await Promise.all([getCategories(),getCurrentUser(),selectedCataloguePromise]);
 const filters:MarketplaceFilters={
  query:first(params.q),
  category:first(params.category),
  condition:(["new","reconditioned","used"] as string[]).includes(condition??"")?condition as PartCondition:undefined,
  sort,
  minPrice:first(params.min)?Number(first(params.min)):undefined,
  maxPrice:first(params.max)?Number(first(params.max)):undefined,
  postcode,
  collectionOnly:first(params.collection)==="1",
  vehicle:legacyVehicleId,
  vehicleRegistration:vehicleRegistration||undefined,
  vehicleColour,
  catalogueVariant:selectedCatalogue?.variantId,
  catalogueYear:selectedCatalogue?.year,
  catalogueFuel:selectedCatalogue?.fuelType??undefined,
  catalogueEngineSize:selectedCatalogue?.engineSizeSimple??undefined,
  compatibleOnly:Boolean(selectedCatalogue||isUuid(first(params.vehicle)))&&first(params.fit)!=="0"
 };
 const [result,vehicles,savedIds,catalogueModels,garageVehicles,recentlyViewed]=await Promise.all([
  getMarketplacePage(filters,{offset:(requestedPage-1)*pageSize,limit:pageSize}),
  legacyVehicleId?getVehicles():Promise.resolve([]),
  user?getSavedPartIds(user.id):Promise.resolve([]),
  getCatalogueModelMap().catch(()=>[]),
  user?getGarageVehicles(user.id):Promise.resolve([]),
  user?getRecentlyViewedListings(user.id,3):Promise.resolve([])
 ]);
 return <><Header/><MarketplaceHome listings={result.data} categories={categories} vehicles={vehicles} catalogueModels={catalogueModels} garageVehicles={garageVehicles} recentlyViewed={recentlyViewed} signedIn={Boolean(user)} filters={filters} selectedCatalogue={selectedCatalogue} savedIds={savedIds} error={result.error} configured={result.configured} pagination={result.pagination} currentPage={requestedPage}/></>;
}
