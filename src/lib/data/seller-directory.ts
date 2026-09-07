import "server-only";

import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import type { SellerBusinessKind } from "@/lib/types";
import { isSellerBusinessKind } from "@/lib/seller-business";

export type SellerDirectoryItem={
 id:string;
 ownerId:string|null;
 businessName:string;
 slug:string;
 location:string;
 description:string;
 sellerType:"business"|"private";
 businessKind:SellerBusinessKind|null;
 verified:boolean;
 handle:string|null;
 soldCount:number;
 boughtCount:number;
 sellerRating:number|null;
 sellerReviewCount:number;
};

export async function getSellerDirectoryPage(offset=0,limit=24){
 const safeLimit=Math.max(1,Math.min(Math.floor(limit),60));
 const safeOffset=Math.max(0,Math.floor(offset));
 const supabase=createSupabasePublicServerClient();
 const {data,error}=await supabase.rpc("get_seller_directory_page",{p_limit:safeLimit,p_offset:safeOffset});
 if(error)throw new Error("Seller directory is temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>safeLimit;
 const visible=raw.slice(0,safeLimit);
 const ids=visible.map(row=>row.seller_id);
 const {data:kindRows,error:kindError}=ids.length
  ?await supabase.from("sellers").select("id,business_kind").in("id",ids)
  :{data:[],error:null};
 if(kindError)throw new Error("Seller directory is temporarily unavailable.");
 const kindById=new Map((kindRows??[]).map(row=>[
  row.id,
  typeof row.business_kind==="string"&&isSellerBusinessKind(row.business_kind)?row.business_kind:null
 ] as const));
 const items:SellerDirectoryItem[]=visible.map(row=>({
  id:row.seller_id,
  ownerId:row.owner_id,
  businessName:row.business_name,
  slug:row.slug,
  location:row.location,
  description:row.description,
  sellerType:row.seller_type==="private"?"private":"business",
  businessKind:kindById.get(row.seller_id)??null,
  verified:Boolean(row.seller_verified),
  handle:row.handle,
  soldCount:Number(row.sold_count??0),
  boughtCount:Number(row.bought_count??0),
  sellerRating:row.seller_rating===null?null:Number(row.seller_rating),
  sellerReviewCount:Number(row.seller_review_count??0)
 }));
 return {items,pagination:{offset:safeOffset,limit:safeLimit,hasMore}};
}
