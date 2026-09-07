import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??20);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):20;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const status=url.searchParams.get("status")?.trim()??"";
 const caseType=url.searchParams.get("type")?.trim()??"";

 let query=supabase
  .from("transaction_cases")
  .select("id,order_item_id,case_type,reason,details,status,previous_fulfilment_status,seller_response,resolution,resolution_notes,return_tracking_carrier,return_tracking_number,return_authorized_at,return_shipped_at,return_received_at,provider_dispute_status,provider_dispute_reason,created_at,resolved_at,order_items!inner(parts(title,slug),sellers(business_name,slug),orders!inner(buyer_id))")
  .eq("order_items.orders.buyer_id",user.id)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false});
 if(status)query=query.eq("status",status.slice(0,60));
 if(caseType)query=query.eq("case_type",caseType.slice(0,60));
 const {data,error}=await query.range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"cases_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 const items=page.flatMap(row=>{
  const orderItem=one(row.order_items);
  const part=orderItem?one(orderItem.parts):null;
  const seller=orderItem?one(orderItem.sellers):null;
  const order=orderItem?one(orderItem.orders):null;
  if(!part||!seller||!order)return [];
  return [{
   id:row.id,
   orderItemId:row.order_item_id,
   caseType:row.case_type,
   reason:row.reason,
   details:row.details,
   status:row.status,
   previousFulfilmentStatus:row.previous_fulfilment_status,
   sellerResponse:row.seller_response,
   resolution:row.resolution,
   resolutionNotes:row.resolution_notes,
   returnTrackingCarrier:row.return_tracking_carrier,
   returnTrackingNumber:row.return_tracking_number,
   returnAuthorizedAt:row.return_authorized_at,
   returnShippedAt:row.return_shipped_at,
   returnReceivedAt:row.return_received_at,
   providerDisputeStatus:row.provider_dispute_status,
   providerDisputeReason:row.provider_dispute_reason,
   createdAt:row.created_at,
   resolvedAt:row.resolved_at,
   partTitle:part.title,
   partSlug:part.slug,
   sellerName:seller.business_name,
   sellerSlug:seller.slug
  }];
 });

 return mobileJson(request,{ok:true,items,pagination:{offset,limit,returned:items.length,hasMore}});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
 const orderItemId=String(input.orderItemId??"");
 const caseType=String(input.caseType??"return");
 const reason=String(input.reason??"").trim();
 const details=String(input.details??"").trim();

 if(!isUuid(orderItemId))return mobileJson(request,{ok:false,error:"invalid_order_item"},400);
 if(!["return","dispute","cancellation"].includes(caseType))return mobileJson(request,{ok:false,error:"invalid_case_type"},400);
 if(reason.length<3)return mobileJson(request,{ok:false,error:"reason_required"},400);
 if(details.length<10)return mobileJson(request,{ok:false,error:"details_required"},400);
 if(details.length>2000)return mobileJson(request,{ok:false,error:"details_too_long"},400);

 const {data,error}=await supabase.rpc("open_transaction_case",{
  p_order_item_id:orderItemId,
  p_case_type:caseType,
  p_reason:reason.slice(0,120),
  p_details:details
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("already open"))return mobileJson(request,{ok:false,error:"case_already_open"},409);
  if(lower.includes("already closed"))return mobileJson(request,{ok:false,error:"transaction_closed"},409);
  if(lower.includes("before dispatch"))return mobileJson(request,{ok:false,error:"cancellation_window_closed"},409);
  if(lower.includes("purchase not found"))return mobileJson(request,{ok:false,error:"forbidden"},403);
  return mobileJson(request,{ok:false,error:"case_open_failed"},409);
 }

 return mobileJson(request,{ok:true,caseId:data},201);
}
