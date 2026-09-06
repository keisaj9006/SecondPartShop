import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const seller=auth.seller;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??20);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):20;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const status=url.searchParams.get("status")?.trim()??"";
 const caseType=url.searchParams.get("type")?.trim()??"";

 let query=supabase
  .from("transaction_cases")
  .select("id,order_item_id,case_type,reason,details,status,previous_fulfilment_status,seller_response,resolution,resolution_notes,return_tracking_carrier,return_tracking_number,return_authorized_at,return_shipped_at,return_received_at,provider_dispute_status,provider_dispute_reason,created_at,resolved_at,order_items!inner(seller_id,parts(title,slug),orders(buyer_id))")
  .eq("order_items.seller_id",seller.id)
  .order("created_at",{ascending:false})
  .order("id");
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
  const order=orderItem?one(orderItem.orders):null;
  if(!orderItem||!part||!order)return [];
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
   buyerId:order.buyer_id
  }];
 });

 return mobileJson(request,{ok:true,items,pagination:{offset,limit,returned:items.length,hasMore}});
}

export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
 const caseId=String(input.caseId??"");
 const action=String(input.action??"respond");

 if(!isUuid(caseId))return mobileJson(request,{ok:false,error:"invalid_case"},400);

 if(action==="respond"){
  const response=String(input.response??"").trim();
  if(response.length<10)return mobileJson(request,{ok:false,error:"response_too_short"},400);
  if(response.length>2000)return mobileJson(request,{ok:false,error:"response_too_long"},400);
  const {error}=await supabase.rpc("seller_respond_transaction_case",{p_case_id:caseId,p_response:response});
  if(error)return mobileJson(request,{ok:false,error:"case_response_failed"},409);
  return mobileJson(request,{ok:true,state:"seller_response"});
 }

 if(action==="confirm_return_received"){
  const {error}=await supabase.rpc("seller_confirm_transaction_return_received",{p_case_id:caseId});
  if(error)return mobileJson(request,{ok:false,error:"return_confirmation_failed"},409);
  return mobileJson(request,{ok:true,state:"returned"});
 }

 return mobileJson(request,{ok:false,error:"invalid_case_action"},400);
}
