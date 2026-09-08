import { getCategories } from "@/lib/data/marketplace";
import { mobileJson,mobileOptions,mobilePublicJson } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 try{
  const items=await getCategories();
  return mobilePublicJson(request,{ok:true,items},200,3600,86400);
 }catch{
  return mobileJson(request,{ok:false,error:"categories_unavailable"},503);
 }
}
