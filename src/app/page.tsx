import { after } from "next/server";
import type { Metadata } from "next";
import { Header } from "@/components/header";
import { MarketplaceHome } from "@/components/marketplace-home";
import { getCategories,getMarketplacePage,getSavedPartIdsForParts,getVehicleById } from "@/lib/data/marketplace";
import { getGarageVehicleById,getGarageVehicleMatch,getGarageVehiclesPage } from "@/lib/data/garage";
import { getRecentlyViewedListings } from "@/lib/data/buyer-account";
import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { compatibilityInfo } from "@/lib/data/compatibility";
import { getCurrentUser } from "@/lib/auth";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import { normalizePostcode } from "@/lib/postcode";
import type { MarketplaceFilters,MarketplaceSort,PartCondition } from "@/lib/types";
import { isUuid } from "@/lib/identifiers";
import { recordMarketplaceSearch } from "@/lib/analytics/search";
import { buildHomeMetadata } from "@/lib/metadata";
import { resolveVehicleContext } from "@/lib/vehicle-context";

export const dynamic="force-dynamic";
export const metadata:Metadata=buildHomeMetadata();

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const requestParams=new URLSearchParams();
 for(const [key,value] of Object.entries(params)){const item=first(value);if(item!==undefined)requestParams.set(key,item);}
 const addVehicleMode=first(params.addVehicle)==="1";
 const initialContext=resolveVehicleContext(requestParams,{viewerId:null,addVehicleMode});
 const [categories,user]=await Promise.all([getCategories(),getCurrentUser()]);
 const requestedGarageId=initialContext.selection.kind==="garage"?initialContext.selection.garageVehicleId:undefined;
 const requestedGarageVehicle=requestedGarageId&&user?await getGarageVehicleById(user.id,requestedGarageId).catch(()=>null):null;
 const activeContext=resolveVehicleContext(requestParams,{
  viewerId:user?.id??null,
  ...(requestedGarageId?{garageValid:Boolean(requestedGarageVehicle)}:{}),
  addVehicleMode
 });
 const activeParams=activeContext.params;
 const selectedGarageVehicle=activeContext.selection.kind==="garage"?requestedGarageVehicle:null;
 const identityOnlyFitmentUnresolved=Boolean(selectedGarageVehicle&&!selectedGarageVehicle.catalogueVariantId&&activeParams.get("fit")!=="0");
 const garageSaveParam=first(params.garageSave);
 const garageSaveOutcome=requestedGarageId&&selectedGarageVehicle&&(garageSaveParam==="created"||garageSaveParam==="already_exists")?garageSaveParam:undefined;
 const condition=activeParams.get("condition")??undefined;
 const requestedSort=first(params.sort);
 const sort=(["best","price_asc","price_desc","distance","delivery","warranty"] as string[]).includes(requestedSort??"")?requestedSort as MarketplaceSort:"best";
 const legacyVehicleId=activeContext.selection.kind==="legacy"&&isUuid(activeContext.selection.vehicleId)?activeContext.selection.vehicleId:undefined;
 const requestedCatalogueVariant=activeContext.selection.kind==="catalogue"?activeContext.selection.variantId:selectedGarageVehicle?.catalogueVariantId??undefined;
 const requestedCatalogueYear=activeContext.selection.kind==="catalogue"?activeContext.selection.year:selectedGarageVehicle?.year;
 const requestedCatalogueFuel=activeContext.selection.kind==="catalogue"?activeContext.selection.fuel:selectedGarageVehicle?.fuelType??undefined;
 const requestedCatalogueEngine=activeContext.selection.kind==="catalogue"?activeContext.selection.engine:selectedGarageVehicle?.engineSizeSimple??undefined;
 const requestedPage=Math.max(1,integer(first(params.page))??1);
 const marketplaceCursor=first(params.cursor)?.trim().slice(0,2048)||undefined;
 const pageSize=24;
 const rawRegistration=selectedGarageVehicle?.registration??activeParams.get("vr")??undefined;
 const vehicleRegistration=rawRegistration?normalizeRegistration(rawRegistration):undefined;
 const vehicleColour=selectedGarageVehicle?.colour??(activeParams.get("vc")?.trim().slice(0,40)||undefined);
 const rawPostcode=first(params.pc);
 const postcode=rawPostcode?normalizePostcode(rawPostcode):undefined;
 const selectedCataloguePromise=requestedCatalogueVariant&&requestedCatalogueYear
  ?getCatalogueSelection(requestedCatalogueVariant,requestedCatalogueYear,requestedCatalogueFuel,requestedCatalogueEngine).catch(()=>null)
  :Promise.resolve(null);
 const selectedCatalogue=await selectedCataloguePromise;
 const invalidFitVehicle=!addVehicleMode&&(Boolean(first(params.q)?.trim())||first(params.fit)!=="0")
  &&(((params.cv!==undefined||params.cy!==undefined||params.cf!==undefined||params.ce!==undefined)&&activeContext.selection.kind==="none")
   ||Boolean(requestedCatalogueVariant&&!selectedCatalogue)
   ||(params.vehicle!==undefined&&activeContext.selection.kind==="none")
   ||(activeContext.selection.kind==="legacy"&&!legacyVehicleId));
 const invalidGarageContext=activeContext.selection.kind==="invalid-garage";
 const filters:MarketplaceFilters={
  query:first(params.q),
  category:first(params.category),
  condition:( ["new","reconditioned","used"] as string[]).includes(condition??"")?condition as PartCondition:undefined,
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
  compatibleOnly:Boolean(selectedCatalogue||legacyVehicleId||selectedGarageVehicle)&&activeParams.get("fit")!=="0"
 };
 const [result,legacyVehicle,garagePage,matchedGarageVehicle,recentlyViewed]=await Promise.all([
  invalidGarageContext?Promise.resolve({data:[],error:"This Garage vehicle is unavailable. Select a vehicle again.",configured:true,pagination:{offset:(requestedPage-1)*pageSize,limit:pageSize,returned:0,total:null,hasMore:false,mode:"offset" as const,nextCursor:null}})
   :invalidFitVehicle?Promise.resolve({data:[],error:"Compatibility data is temporarily unavailable.",configured:true,pagination:{offset:(requestedPage-1)*pageSize,limit:pageSize,returned:0,total:null,hasMore:false,mode:"offset" as const,nextCursor:null}})
   :identityOnlyFitmentUnresolved?Promise.resolve({data:[],error:null,configured:true,pagination:{offset:(requestedPage-1)*pageSize,limit:pageSize,returned:0,total:0,hasMore:false,mode:"offset" as const,nextCursor:null}})
   :getMarketplacePage(filters,{offset:(requestedPage-1)*pageSize,limit:pageSize,cursor:marketplaceCursor,lean:true}),
  legacyVehicleId?getVehicleById(legacyVehicleId):Promise.resolve(null),
  user?getGarageVehiclesPage(user.id,{limit:4}).catch(()=>({items:[],hasMore:false,offset:0,limit:4})):Promise.resolve({items:[],hasMore:false,offset:0,limit:4}),
  user&&selectedCatalogue&&!selectedGarageVehicle?getGarageVehicleMatch(user.id,{catalogueVariantId:selectedCatalogue.variantId,year:selectedCatalogue.year,fuelType:selectedCatalogue.fuelType,engineSizeSimple:selectedCatalogue.engineSizeSimple,registration:vehicleRegistration??null}).catch(()=>null):Promise.resolve(null),
  user?getRecentlyViewedListings(user.id,3):Promise.resolve([])
 ]);
 const marketplaceListings=selectedGarageVehicle&&!selectedGarageVehicle.catalogueVariantId&&filters.compatibleOnly===false
  ?result.data.map(listing=>({...listing,compatibility:compatibilityInfo("unverified")}))
  :result.data;
 if(!result.error&&requestedPage===1&&!marketplaceCursor&&filters.query?.trim()){
  const count=result.pagination.total??(result.pagination.returned+(result.pagination.hasMore?1:0));
  after(()=>recordMarketplaceSearch({source:"web",query:filters.query,resultCount:count,vehicleContext:Boolean(filters.vehicle||filters.catalogueVariant||selectedGarageVehicle),compatibleOnly:filters.compatibleOnly!==false,categoryId:filters.category}));
 }
 const vehicles=legacyVehicle?[legacyVehicle]:[];
 const garageVehicleForCard=selectedGarageVehicle??matchedGarageVehicle;
 const garageVehicles=garageVehicleForCard&&!garagePage.items.some(vehicle=>vehicle.id===garageVehicleForCard.id)?[garageVehicleForCard,...garagePage.items]:garagePage.items;
 const visiblePartIds=[...marketplaceListings.map(item=>item.id),...recentlyViewed.map(item=>item.id)];
 const savedIds=user?await getSavedPartIdsForParts(user.id,visiblePartIds):[];
 return <><Header/><MarketplaceHome freshVehicleSelection={addVehicleMode} activeGarageVehicleId={selectedGarageVehicle?.id} garageContextValid={!requestedGarageId||Boolean(requestedGarageVehicle)} identityOnlyFitmentUnresolved={identityOnlyFitmentUnresolved} garageSaveOutcome={garageSaveOutcome} listings={marketplaceListings} categories={categories} vehicles={vehicles} garageVehicles={garageVehicles} recentlyViewed={recentlyViewed} signedIn={Boolean(user)} viewerId={user?.id??null} filters={filters} selectedCatalogue={selectedCatalogue} savedIds={savedIds} error={result.error} configured={result.configured} pagination={result.pagination} currentPage={requestedPage} currentCursor={marketplaceCursor}/></>;
}
