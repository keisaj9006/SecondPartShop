import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??30);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):30;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const status=url.searchParams.get("status")?.trim()??"";

 let query=supabase
  .from("listing_conversations")
  .select("id,part_id,buyer_id,status,last_message_at,parts(title,slug),sellers(business_name,owner_id)")
  .order("last_message_at",{ascending:false})
  .order("id");
 if(status==="open"||status==="closed")query=query.eq("status",status);
 const {data,error}=await query.range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"inbox_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 const items=page.flatMap(row=>{
  const part=one(row.parts);
  const seller=one(row.sellers);
  if(!part||!seller)return [];
  return [{
   id:row.id,
   partId:row.part_id,
   partTitle:part.title,
   partSlug:part.slug,
   sellerName:seller.business_name,
   buyerId:row.buyer_id,
   sellerOwnerId:seller.owner_id,
   status:row.status,
   lastMessageAt:row.last_message_at
  }];
 });

 return mobileJson(request,{ok:true,items,pagination:{offset,limit,returned:items.length,hasMore}});
}
