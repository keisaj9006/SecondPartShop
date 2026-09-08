import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { isUuid } from "@/lib/identifiers";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??24);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):24;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;

 const {data,error}=await supabase.rpc("seller_ranked_part_request_leads",{p_limit:limit,p_offset:offset});
 if(error)return mobileJson(request,{ok:false,error:"seller_requests_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);
 const requestIds=page.map(row=>row.request_id);
 const {data:drafts,error:draftError}=requestIds.length
  ?await supabase.from("parts")
    .select("id,source_request_id,title,updated_at")
    .eq("seller_id",auth.seller.id)
    .eq("status","draft")
    .in("source_request_id",requestIds)
    .order("updated_at",{ascending:false})
  :{data:[],error:null};
 if(draftError)return mobileJson(request,{ok:false,error:"seller_requests_unavailable"},503);
 const draftByRequest=new Map<string,{id:string;title:string}>();
 for(const draft of drafts??[]){
  if(draft.source_request_id&&!draftByRequest.has(draft.source_request_id)){
   draftByRequest.set(draft.source_request_id,{id:draft.id,title:draft.title});
  }
 }

 return mobileJson(request,{ok:true,items:page.map(row=>({
  id:row.request_id,
  queryText:row.query_text,
  oemNumber:row.oem_number,
  notes:row.notes,
  createdAt:row.created_at,
  categoryId:row.category_id,
  categoryName:row.category_name,
  variantId:row.catalogue_variant_id,
  vehicleMake:row.vehicle_make,
  vehicleModel:row.vehicle_model,
  vehicleVariant:row.vehicle_variant,
  year:row.year,
  fuelType:row.fuel_type,
  engineSizeSimple:row.engine_size_simple,
  matchScore:Number(row.match_score??0),
  matchReasons:row.match_reasons??[],
  draftPartId:draftByRequest.get(row.request_id)?.id??null,
  draftPartTitle:draftByRequest.get(row.request_id)?.title??null
 })),pagination:{offset,limit,returned:page.length,hasMore}});
}


export async function PATCH(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"?payload as Record<string,unknown>:{};
 const requestId=String(input.requestId??"").trim();
 const action=String(input.action??"").trim();
 if(!isUuid(requestId))return mobileJson(request,{ok:false,error:"invalid_part_request"},400);
 if(action!=="dismiss")return mobileJson(request,{ok:false,error:"invalid_request_action"},400);
 const {data,error}=await supabase.rpc("dismiss_seller_part_request_match",{p_request_id:requestId});
 if(error)return mobileJson(request,{ok:false,error:"request_match_update_failed"},503);
 return mobileJson(request,{ok:true,dismissed:Boolean(data)});
}
