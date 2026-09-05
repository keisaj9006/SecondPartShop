import { Header } from "@/components/header";
import { MarketplaceHome } from "@/components/marketplace-home";
import { getCategories,getListings,getSavedPartIds,getVehicles } from "@/lib/data/marketplace";
import { getCatalogueModelMap,getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { getCurrentUser } from "@/lib/auth";
import type { MarketplaceFilters,PartCondition } from "@/lib/types";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const integer=(value:string|undefined)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const condition=first(params.condition);
 const requestedCatalogueVariant=first(params.cv);
 const requestedCatalogueYear=integer(first(params.cy));
 const requestedCatalogueFuel=first(params.cf);
 const requestedCatalogueEngine=integer(first(params.ce));
 const [categories,user]=await Promise.all([getCategories(),getCurrentUser()]);
 const selectedCatalogue=requestedCatalogueVariant&&requestedCatalogueYear
  ?await getCatalogueSelection(requestedCatalogueVariant,requestedCatalogueYear,requestedCatalogueFuel,requestedCatalogueEngine)
  :null;
 const filters:MarketplaceFilters={
  query:first(params.q),
  category:first(params.category),
  condition:(["new","reconditioned","used"] as string[]).includes(condition??"")?condition as PartCondition:undefined,
  minPrice:first(params.min)?Number(first(params.min)):undefined,
  maxPrice:first(params.max)?Number(first(params.max)):undefined,
  vehicle:first(params.vehicle),
  catalogueVariant:selectedCatalogue?.variantId,
  catalogueYear:selectedCatalogue?.year,
  catalogueFuel:selectedCatalogue?.fuelType??undefined,
  catalogueEngineSize:selectedCatalogue?.engineSizeSimple??undefined
 };
 const [result,vehicles,savedIds,catalogueModels]=await Promise.all([
  getListings(filters),
  getVehicles(),
  user?getSavedPartIds(user.id):Promise.resolve([]),
  getCatalogueModelMap()
 ]);
 return <><Header/><MarketplaceHome listings={result.data} categories={categories} vehicles={vehicles} catalogueModels={catalogueModels} filters={filters} selectedCatalogue={selectedCatalogue} savedIds={savedIds} error={result.error} configured={result.configured}/><footer className="border-t border-black/10 px-4 py-8 text-sm text-[#63706a]"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row"><span>© 2026 SecondPart Ltd.</span><span>Built for the UK automotive trade.</span></div></footer></>;
}
