import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { getListings } from "@/lib/data/marketplace";
import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions } from "@/lib/mobile-api";
import { sortMarketplaceListings } from "@/lib/marketplace-sort";
import { enrichListingsWithDistance,normalizePostcode } from "@/lib/postcode";
import type { MarketplaceFilters,MarketplaceSort,PartCondition } from "@/lib/types";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const integer=(value:string|null)=>{
 if(!value)return undefined;
 const parsed=Number(value);
 return Number.isInteger(parsed)?parsed:undefined;
};
const moneyNumber=(value:string|null)=>{
 if(!value)return undefined;
 const parsed=Number(value);
 return Number.isFinite(parsed)?parsed:undefined;
};

export async function GET(request:Request){
 const url=new URL(request.url);
 const condition=url.searchParams.get("condition");
 const requestedSort=url.searchParams.get("sort");
 const sort=(["best","price_asc","price_desc","distance","delivery","warranty"] as string[]).includes(requestedSort??"")
  ?requestedSort as MarketplaceSort
  :"best";
 const variantId=isUuid(url.searchParams.get("cv"))?url.searchParams.get("cv")??undefined:undefined;
 const year=integer(url.searchParams.get("cy"));
 const fuel=url.searchParams.get("cf")?.trim()||undefined;
 const engine=integer(url.searchParams.get("ce"));
 const postcodeRaw=url.searchParams.get("pc")?.trim()||undefined;
 const postcode=postcodeRaw?normalizePostcode(postcodeRaw):undefined;
 const selectedCatalogue=variantId&&year
  ?await getCatalogueSelection(variantId,year,fuel,engine).catch(()=>null)
  :null;

 const filters:MarketplaceFilters={
  query:url.searchParams.get("q")?.trim()||undefined,
  category:url.searchParams.get("category")?.trim()||undefined,
  condition:(["new","reconditioned","used"] as string[]).includes(condition??"")?condition as PartCondition:undefined,
  sort,
  minPrice:moneyNumber(url.searchParams.get("min")),
  maxPrice:moneyNumber(url.searchParams.get("max")),
  postcode,
  collectionOnly:url.searchParams.get("collection")==="1",
  catalogueVariant:selectedCatalogue?.variantId,
  catalogueYear:selectedCatalogue?.year,
  catalogueFuel:selectedCatalogue?.fuelType??undefined,
  catalogueEngineSize:selectedCatalogue?.engineSizeSimple??undefined,
  compatibleOnly:Boolean(selectedCatalogue)&&url.searchParams.get("fit")!=="0"
 };

 const result=await getListings(filters);
 if(result.error)return mobileJson(request,{ok:false,error:"marketplace_unavailable",message:result.error},503);
 const withDistance=await enrichListingsWithDistance(result.data,postcode);
 const sorted=sortMarketplaceListings(withDistance,sort);
 const limit=Math.max(1,Math.min(integer(url.searchParams.get("limit"))??40,100));
 const offset=Math.max(0,integer(url.searchParams.get("offset"))??0);
 const page=sorted.slice(offset,offset+limit);

 return mobileJson(request,{
  ok:true,
  items:page,
  pagination:{
   offset,
   limit,
   returned:page.length,
   total:sorted.length,
   hasMore:offset+page.length<sorted.length
  },
  vehicle:selectedCatalogue
 });
}
