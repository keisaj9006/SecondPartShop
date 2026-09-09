import { after } from "next/server";
import { Header } from "@/components/header";
import { MarketplaceHome } from "@/components/marketplace-home";
import { getCategories,getMarketplacePage,getSavedPartIdsForParts,getVehicleById } from "@/lib/data/marketplace";
import { getGarageVehicleMatch,getGarageVehiclesPage } from "@/lib/data/garage";
import { getRecentlyViewedListings } from "@/lib/data/buyer-account";
import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { getCurrentUser } from "@/lib/auth";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import { normalizePostcode } from "@/lib/postcode";
import type { MarketplaceFilters,MarketplaceSort,PartCondition } from "@/lib/types";
import { isUuid } from "@/lib/identifiers";
import { recordMarketplaceSearch } from "@/lib/analytics/search";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const condition=first(params.condition);
 const addVehicleMode=first(params.addVehicle)==="1";
 const requestedSort=first(params.sort);
 const sort=(["best","price_asc","price_desc","distance","delivery","warranty"] as string[]).includes(requestedSort??"")?requestedSort as MarketplaceSort:"best";
 const legacyVehicleId=!addVehicleMode&&isUuid(first(params.vehicle))?first(params.vehicle):undefined;
 const requestedCatalogueVariant=!addVehicleMode&&isUuid(first(params.cv))?first(params.cv):undefined;
 const requestedCatalogueYear=addVehicleMode?undefined:integer(first(params.cy));
 const requestedCatalogueFuel=addVehicleMode?undefined:first(params.cf);
 const requestedCatalogueEngine=addVehicleMode?undefined:integer(first(params.ce));
 const requestedPage=Math.max(1,integer(first(params.page))??1);
 const marketplaceCursor=first(params.cursor);
 const pageSize=24;
 const rawRegistration=addVehicleMode?undefined:first(params.vr);
 const vehicleRegistration=rawRegistration?normalizeRegistration(rawRegistration):undefined;
 const vehicleColour=addVehicleMode?undefined:first(params.vc)?.trim().slice(0,40)||undefined;
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
 const [result,legacyVehicle,garagePage,selectedGarageVehicle,recentlyViewed]=await Promise.all([
  getMarketplacePage(filters,{offset:(requestedPage-1)*pageSize,limit:pageSize,cursor:marketplaceCursor,lean:true}),
  legacyVehicleId?getVehicleById(legacyVehicleId):Promise.resolve(null),
  user?getGarageVehiclesPage(user.id,{limit:4}).catch(()=>({items:[],hasMore:false,offset:0,limit:4})):Promise.resolve({items:[],hasMore:false,offset:0,limit:4}),
  user&&selectedCatalogue?getGarageVehicleMatch(user.id,{catalogueVariantId:selectedCatalogue.variantId,year:selectedCatalogue.year,fuelType:selectedCatalogue.fuelType,engineSizeSimple:selectedCatalogue.engineSizeSimple,registration:vehicleRegistration??null}).catch(()=>null):Promise.resolve(null),
  user?getRecentlyViewedListings(user.id,3):Promise.resolve([])
 ]);
 if(requestedPage===1&&filters.query?.trim()){
  const count=result.pagination.total??(result.pagination.returned+(result.pagination.hasMore?1:0));
  after(()=>recordMarketplaceSearch({
   source:"web",
   query:filters.query,
   resultCount:count,
   vehicleContext:Boolean(filters.vehicle||filters.catalogueVariant),
   compatibleOnly:filters.compatibleOnly!==false,
   categoryId:filters.category
  }));
 }
 const vehicles=legacyVehicle?[legacyVehicle]:[];
 const garageVehicles=selectedGarageVehicle&&!garagePage.items.some(vehicle=>vehicle.id===selectedGarageVehicle.id)?[selectedGarageVehicle,...garagePage.items]:garagePage.items;
 const visiblePartIds=[...result.data.map(item=>item.id),...recentlyViewed.map(item=>item.id)];
 const savedIds=user?await getSavedPartIdsForParts(user.id,visiblePartIds):[];
 return <><Header/><MarketplaceHome freshVehicleSelection={addVehicleMode} listings={result.data} categories={categories} vehicles={vehicles} garageVehicles={garageVehicles} recentlyViewed={recentlyViewed} signedIn={Boolean(user)} filters={filters} selectedCatalogue={selectedCatalogue} savedIds={savedIds} error={result.error} configured={result.configured} pagination={result.pagination} currentPage={requestedPage}/></>;
}
