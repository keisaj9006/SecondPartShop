import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 const {data,error}=await supabase
  .from("listing_conversations")
  .select("id,part_id,buyer_id,status,last_message_at,parts(title,slug),sellers(business_name,owner_id)")
  .order("last_message_at",{ascending:false});
 if(error)return mobileJson(request,{ok:false,error:"inbox_unavailable"},503);

 const items=(data??[]).flatMap(row=>{
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

 return mobileJson(request,{ok:true,items});
}
