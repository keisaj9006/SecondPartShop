import { getListingBySlug } from "@/lib/data/marketplace";
import { mobileJson,mobileOptions } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const safeSlug=slug.trim().slice(0,180);
 if(!safeSlug)return mobileJson(request,{ok:false,error:"invalid_listing"},400);

 const result=await getListingBySlug(safeSlug);
 if(result.error)return mobileJson(request,{ok:false,error:"listing_unavailable"},503);
 if(!result.data)return mobileJson(request,{ok:false,error:"not_found"},404);
 return mobileJson(request,{ok:true,item:result.data});
}
