import { getListingBySlug } from "@/lib/data/marketplace";
import { getPublicMemberProfileById } from "@/lib/data/reputation";
import { getPartCompatibility } from "@/lib/data/compatibility";
import { isSellerCheckoutReady } from "@/lib/data/checkout";
import { isStripeCheckoutConfigured } from "@/lib/stripe-payments";
import { isUuid } from "@/lib/identifiers";
import type { MarketplaceFilters } from "@/lib/types";
import { mobileJson,mobileOptions,mobilePublicJson } from "@/lib/mobile-api";
import { mobileThumbnailUrl } from "@/lib/mobile-image";
import { getSellerDistanceFromPostcode } from "@/lib/seller-geo";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const integer=(value:string|null)=>{if(!value)return undefined;const parsed=Number(value);return Number.isInteger(parsed)?parsed:undefined;};

export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const safeSlug=slug.trim().slice(0,180);
 if(!safeSlug)return mobileJson(request,{ok:false,error:"invalid_listing"},400);

 const url=new URL(request.url);
 const filters:MarketplaceFilters={
  catalogueVariant:isUuid(url.searchParams.get("cv"))?url.searchParams.get("cv")??undefined:undefined,
  catalogueYear:integer(url.searchParams.get("cy")),
  catalogueFuel:url.searchParams.get("cf")?.trim()||undefined,
  catalogueEngineSize:integer(url.searchParams.get("ce"))
 };
 const result=await getListingBySlug(safeSlug);
 if(result.error)return mobileJson(request,{ok:false,error:"listing_unavailable"},503);
 if(!result.data)return mobileJson(request,{ok:false,error:"not_found"},404);
 const [reputation,compatibility,sellerCheckoutReady,sellerDistance]=await Promise.all([
  getPublicMemberProfileById(result.data.seller.ownerId).catch(()=>null),
  (filters.catalogueVariant&&filters.catalogueYear!==undefined)?getPartCompatibility(result.data.id,filters).catch(()=>null):Promise.resolve(null),
  isSellerCheckoutReady(result.data.sellerId).catch(()=>false),
  getSellerDistanceFromPostcode(result.data.sellerId,url.searchParams.get("pc")).catch(()=>null)
 ]);
 const item={...result.data,images:result.data.images.map(image=>({...image,thumbnailUrl:mobileThumbnailUrl(request,image.url)}))};
 return mobilePublicJson(request,{ok:true,item,sellerReputation:reputation,compatibility,distance:sellerDistance,checkoutReady:isStripeCheckoutConfigured()&&sellerCheckoutReady},200,15,60);
}
