import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TransactionCase } from "@/lib/types";

type CaseRow={
 id:string;
 order_item_id:string;
 case_type:"return"|"dispute"|"cancellation";
 reason:string;
 details:string;
 status:TransactionCase["status"];
 previous_fulfilment_status:string;
 seller_response:string|null;
 resolution:TransactionCase["resolution"];
 resolution_notes:string|null;
 return_tracking_carrier:string|null;
 return_tracking_number:string|null;
 return_authorized_at:string|null;
 return_shipped_at:string|null;
 return_received_at:string|null;
 provider_dispute_id:string|null;
 provider_dispute_status:string|null;
 provider_dispute_reason:string|null;
 created_at:string;
 resolved_at:string|null;
 order_items:{
  seller_id:string;
  parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
  sellers:{business_name:string;slug:string}|Array<{business_name:string;slug:string}>|null;
  orders:{buyer_id:string}|Array<{buyer_id:string}>|null;
 }|Array<{
  seller_id:string;
  parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
  sellers:{business_name:string;slug:string}|Array<{business_name:string;slug:string}>|null;
  orders:{buyer_id:string}|Array<{buyer_id:string}>|null;
 }>|null;
};

type EligibleOrderItemRow={
 id:string;
 fulfilment_status:string;
 parts:{title:string}|Array<{title:string}>|null;
 sellers:{business_name:string}|Array<{business_name:string}>|null;
 orders:{buyer_id:string;payment_status:string}|Array<{buyer_id:string;payment_status:string}>|null;
};

export type CaseEligiblePurchase={
 id:string;
 partTitle:string;
 sellerName:string;
};

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;
const activeCaseStatuses=["open","seller_response","under_review","return_authorized","return_shipped","returned"];

const mapCaseRows=(rows:unknown[]):TransactionCase[]=>rows.flatMap(row=>{
 const raw=row as CaseRow;
 const item=one(raw.order_items);
 const part=item?one(item.parts):null;
 const seller=item?one(item.sellers):null;
 const order=item?one(item.orders):null;
 if(!part||!seller||!order)return [];
 return [{
  id:raw.id,
  orderItemId:raw.order_item_id,
  caseType:raw.case_type,
  reason:raw.reason,
  details:raw.details,
  status:raw.status,
  previousFulfilmentStatus:raw.previous_fulfilment_status,
  sellerResponse:raw.seller_response,
  resolution:raw.resolution,
  resolutionNotes:raw.resolution_notes,
  returnTrackingCarrier:raw.return_tracking_carrier,
  returnTrackingNumber:raw.return_tracking_number,
  returnAuthorizedAt:raw.return_authorized_at,
  returnShippedAt:raw.return_shipped_at,
  returnReceivedAt:raw.return_received_at,
  providerDisputeId:raw.provider_dispute_id,
  providerDisputeStatus:raw.provider_dispute_status,
  providerDisputeReason:raw.provider_dispute_reason,
  createdAt:raw.created_at,
  resolvedAt:raw.resolved_at,
  partTitle:part.title,
  partSlug:part.slug,
  sellerName:seller.business_name,
  sellerSlug:seller.slug,
  buyerId:order.buyer_id
 }];
});

export async function getTransactionCasesPage(options:{offset?:number;limit?:number;buyerId?:string;sellerId?:string;status?:string;caseType?:string}={}):Promise<{items:TransactionCase[];hasMore:boolean;offset:number;limit:number}>{
 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??20),60));
 const supabase=await createSupabaseServerClient();
 let query=supabase
  .from("transaction_cases")
  .select("id,order_item_id,case_type,reason,details,status,previous_fulfilment_status,seller_response,resolution,resolution_notes,return_tracking_carrier,return_tracking_number,return_authorized_at,return_shipped_at,return_received_at,provider_dispute_id,provider_dispute_status,provider_dispute_reason,created_at,resolved_at,order_items!inner(seller_id,parts(title,slug),sellers(business_name,slug),orders!inner(buyer_id))")
  .order("created_at",{ascending:false})
  .order("id",{ascending:false});
 if(options.buyerId)query=query.eq("order_items.orders.buyer_id",options.buyerId);
 if(options.sellerId)query=query.eq("order_items.seller_id",options.sellerId);
 if(options.status)query=query.eq("status",options.status.slice(0,60));
 if(options.caseType)query=query.eq("case_type",options.caseType.slice(0,60));
 const {data,error}=await query.range(offset,offset+limit);
 if(error)throw new Error("Transaction cases are temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>limit;
 return {items:mapCaseRows(raw.slice(0,limit) as unknown[]),hasMore,offset,limit};
}

export async function getBuyerTransactionCasesPage(profileId:string,options:{offset?:number;limit?:number}={}){
 return getTransactionCasesPage({...options,buyerId:profileId});
}

export async function getSellerTransactionCasesPage(sellerId:string,options:{offset?:number;limit?:number}={}){
 return getTransactionCasesPage({...options,sellerId});
}

export async function getTransactionCases():Promise<TransactionCase[]>{
 return (await getTransactionCasesPage({limit:60})).items;
}

export async function getActiveCaseOrderItemIds(orderItemIds:string[]):Promise<Set<string>>{
 const ids=[...new Set(orderItemIds)].slice(0,200);
 if(!ids.length)return new Set();
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("transaction_cases")
  .select("order_item_id")
  .in("order_item_id",ids)
  .in("status",activeCaseStatuses);
 if(error)throw new Error("Active transaction cases are temporarily unavailable.");
 return new Set((data??[]).map(row=>row.order_item_id));
}

export async function getBuyerCaseOrderItem(profileId:string,orderItemId:string):Promise<CaseEligiblePurchase|null>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("order_items")
  .select("id,fulfilment_status,parts(title),sellers(business_name),orders!inner(buyer_id,payment_status)")
  .eq("id",orderItemId)
  .eq("orders.buyer_id",profileId)
  .maybeSingle();
 if(error||!data)return null;
 const raw=data as unknown as EligibleOrderItemRow;
 const part=one(raw.parts);
 const seller=one(raw.sellers);
 const order=one(raw.orders);
 if(!part||!seller||!order)return null;
 if(!["paid","disputed"].includes(order.payment_status))return null;
 if(["cancelled","refunded","returned"].includes(raw.fulfilment_status))return null;
 return {id:raw.id,partTitle:part.title,sellerName:seller.business_name};
}
