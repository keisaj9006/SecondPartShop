import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TransactionCase } from "@/lib/types";

type CaseRow={
 id:string;
 order_item_id:string;
 case_type:"return"|"dispute";
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
  parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
  sellers:{business_name:string;slug:string}|Array<{business_name:string;slug:string}>|null;
  orders:{buyer_id:string}|Array<{buyer_id:string}>|null;
 }|Array<{
  parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
  sellers:{business_name:string;slug:string}|Array<{business_name:string;slug:string}>|null;
  orders:{buyer_id:string}|Array<{buyer_id:string}>|null;
 }>|null;
};

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function getTransactionCases():Promise<TransactionCase[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("transaction_cases")
  .select("id,order_item_id,case_type,reason,details,status,previous_fulfilment_status,seller_response,resolution,resolution_notes,return_tracking_carrier,return_tracking_number,return_authorized_at,return_shipped_at,return_received_at,provider_dispute_id,provider_dispute_status,provider_dispute_reason,created_at,resolved_at,order_items(parts(title,slug),sellers(business_name,slug),orders(buyer_id))")
  .order("created_at",{ascending:false});
 if(error)throw new Error("Transaction cases are temporarily unavailable.");

 return (data??[]).flatMap(row=>{
  const raw=row as unknown as CaseRow;
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
}
