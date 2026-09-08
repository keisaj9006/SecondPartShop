import { mobileJson,mobileOptions } from "@/lib/mobile-api";
import { getGaragePartnersPage } from "@/lib/data/fitting";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??40);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):40;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const query=String(url.searchParams.get("q")??"").replace(/[^a-zA-Z0-9 -]/g," ").replace(/\s+/g," ").trim().slice(0,80);
 let result;
 try{result=await getGaragePartnersPage(offset,limit,query);}
 catch{return mobileJson(request,{ok:false,error:"garages_unavailable"},503);}
 return mobileJson(request,{
  ok:true,
  items:result.items.map(row=>({
   id:row.id,businessName:row.businessName,slug:row.slug,location:row.location,postcode:row.postcode,
   description:row.description,mobileFitting:row.mobileFitting,verified:Boolean(row.verifiedAt),
   distanceMiles:row.distanceMiles
  })),
  query:query||null,
  nearbyPostcode:result.nearbyPostcode,
  pagination:{offset,limit,hasMore:result.hasMore}
 });
}
