import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PartRequestResponse,PartRequestWithResponses } from "@/lib/part-request-response";
import type { PartRequest } from "@/lib/types";

type RawRequest={
 id:string;
 query_text:string;
 oem_number:string|null;
 notes:string|null;
 status:"open"|"closed";
 registration:string|null;
 year:number|null;
 fuel_type:string|null;
 engine_size_simple:number|null;
 created_at:string;
 categories:{name:string}|{name:string}[]|null;
 vehicle_catalogue_variants:{make:string;model_family:string;variant:string}|{make:string;model_family:string;variant:string}[]|null;
};
type RawResponse={
 id:string;
 source_request_id:string|null;
 slug:string;
 title:string;
 price_pence:number;
 shipping_pence:number;
 dispatch_days:number;
 warranty_days:number;
 condition:PartRequestResponse["condition"];
 sellers:{business_name:string;verified_at:string|null}|{business_name:string;verified_at:string|null}[];
};
const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;
const responseSelect="id,source_request_id,slug,title,price_pence,shipping_pence,dispatch_days,warranty_days,condition,sellers!inner(business_name,verified_at)";

export async function getPartRequestsPage(profileId:string,options:{offset?:number;limit?:number}={}):Promise<{items:PartRequestWithResponses[];hasMore:boolean;offset:number;limit:number}>{
 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??20),60));
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("part_requests")
  .select("id,query_text,oem_number,notes,status,registration,year,fuel_type,engine_size_simple,created_at,categories(name),vehicle_catalogue_variants(make,model_family,variant)")
  .eq("profile_id",profileId)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false})
  .range(offset,offset+limit);
 if(error)throw error;

 const rawRows=data??[];
 const hasMore=rawRows.length>limit;
 const pageRows=rawRows.slice(0,limit);
 const requestIds=pageRows.map(row=>row.id);
 const openIds=pageRows.filter(row=>row.status==="open").map(row=>row.id);
 const [{data:matchRows,error:matchError},{data:responseRows,error:responseError}]=await Promise.all([
  openIds.length
   ?supabase.rpc("buyer_part_request_match_counts_for_ids",{request_ids:openIds})
   :Promise.resolve({data:[],error:null}),
  requestIds.length
   ?supabase.from("parts").select(responseSelect).in("source_request_id",requestIds).eq("status","active").order("created_at",{ascending:false})
   :Promise.resolve({data:[],error:null})
 ]);
 if(matchError)throw matchError;
 if(responseError)throw responseError;

 const matchMap=new Map((matchRows??[]).map(row=>[row.request_id,{matching:Number(row.matching_seller_count??0),verified:Number(row.verified_seller_count??0)}] as const));
 const responseMap=new Map<string,PartRequestResponse[]>();
 for(const row of responseRows??[]){
  const raw=row as unknown as RawResponse;
  if(!raw.source_request_id)continue;
  const seller=one(raw.sellers);
  const responses=responseMap.get(raw.source_request_id)??[];
  if(responses.length>=6)continue;
  responses.push({
   requestId:raw.source_request_id,
   id:raw.id,
   slug:raw.slug,
   title:raw.title,
   pricePence:raw.price_pence,
   shippingPence:raw.shipping_pence,
   totalPence:raw.price_pence+raw.shipping_pence,
   dispatchDays:raw.dispatch_days,
   warrantyDays:raw.warranty_days,
   condition:raw.condition,
   sellerName:seller.business_name,
   sellerVerified:Boolean(seller.verified_at)
  });
  responseMap.set(raw.source_request_id,responses);
 }

 const items=pageRows.map(row=>{
  const raw=row as unknown as RawRequest;
  const category=raw.categories?one(raw.categories):null;
  const vehicle=raw.vehicle_catalogue_variants?one(raw.vehicle_catalogue_variants):null;
  const vehicleLabel=vehicle
   ?[vehicle.make+" "+vehicle.model_family,raw.year?String(raw.year):null,raw.engine_size_simple?String(raw.engine_size_simple)+"cc":null,raw.fuel_type].filter(Boolean).join(" · ")
   :null;
  const match=matchMap.get(raw.id)??{matching:0,verified:0};
  return {id:raw.id,queryText:raw.query_text,oemNumber:raw.oem_number,notes:raw.notes,status:raw.status,registration:raw.registration,year:raw.year,fuelType:raw.fuel_type,engineSizeSimple:raw.engine_size_simple,createdAt:raw.created_at,categoryName:category?.name??null,vehicleLabel,matchingSellerCount:match.matching,verifiedSellerCount:match.verified,responses:responseMap.get(raw.id)??[]};
 });
 return {items,hasMore,offset,limit};
}

export async function getPartRequests(profileId:string):Promise<PartRequest[]>{
 return (await getPartRequestsPage(profileId,{limit:60})).items;
}
