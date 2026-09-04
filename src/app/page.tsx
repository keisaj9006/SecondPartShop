import { Header } from "@/components/header";
import { MarketplaceHome } from "@/components/marketplace-home";
import { getCategories,getFilterOptions,getListings,getSavedPartIds,getVehicles } from "@/lib/data/marketplace";
import { getCurrentUser } from "@/lib/auth";
import type { MarketplaceFilters,PartCondition } from "@/lib/types";
export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const condition=first(params.condition);
 const category=first(params.category);
 const categories=await getCategories();
 const selectedCategory=categories.find(item=>item.id===category);
 const transmissionRelevant=Boolean(selectedCategory?.isTransmissionRelated);
 const filters:MarketplaceFilters={query:first(params.q),category,condition:(["new","reconditioned","used"] as string[]).includes(condition??"")?condition as PartCondition:undefined,gearboxFamily:transmissionRelevant?first(params.family):undefined,gearboxCode:transmissionRelevant?first(params.code):undefined,minPrice:first(params.min)?Number(first(params.min)):undefined,maxPrice:first(params.max)?Number(first(params.max)):undefined,vehicle:first(params.vehicle)};
 const user=await getCurrentUser();
 const [result,vehicles,options,savedIds]=await Promise.all([getListings(filters),getVehicles(),getFilterOptions(),user?getSavedPartIds(user.id):Promise.resolve([])]);
 return <><Header/><MarketplaceHome listings={result.data} categories={categories} vehicles={vehicles} families={options.families} codes={options.codes} filters={filters} savedIds={savedIds} error={result.error} configured={result.configured}/><footer className="border-t border-black/10 px-4 py-8 text-sm text-[#63706a]"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row"><span>© 2026 SecondPart Ltd.</span><span>Built for the UK automotive trade.</span></div></footer></>;
}
