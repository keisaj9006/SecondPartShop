import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;

export async function getPartRequestsPage(profileId:string,options:{offset?:number;limit?:number}={}):Promise<{items:PartRequest[];hasMore:boolean;offset:number;limit:number}>{
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
 const openIds=pageRows.filter(row=>row.status==="open").map(row=>row.id);
 const {data:matchRows,error:matchError}=openIds.length
  ?await supabase.rpc("buyer_part_request_match_counts_for_ids",{request_ids:openIds})
  :{data:[],error:null};
 if(matchError)throw matchError;

 const matchMap=new Map((matchRows??[]).map(row=>[row.request_id,{matching:Number(row.matching_seller_count??0),verified:Number(row.verified_seller_count??0)}] as const));
 const items=pageRows.map(row=>{
  const raw=row as unknown as RawRequest;
  const category=raw.categories?one(raw.categories):null;
  const vehicle=raw.vehicle_catalogue_variants?one(raw.vehicle_catalogue_variants):null;
  const vehicleLabel=vehicle
   ?[vehicle.make+" "+vehicle.model_family,raw.year?String(raw.year):null,raw.engine_size_simple?String(raw.engine_size_simple)+"cc":null,raw.fuel_type].filter(Boolean).join(" · ")
   :null;
  const match=matchMap.get(raw.id)??{matching:0,verified:0};
  return {id:raw.id,queryText:raw.query_text,oemNumber:raw.oem_number,notes:raw.notes,status:raw.status,registration:raw.registration,year:raw.year,fuelType:raw.fuel_type,engineSizeSimple:raw.engine_size_simple,createdAt:raw.created_at,categoryName:category?.name??null,vehicleLabel,matchingSellerCount:match.matching,verifiedSellerCount:match.verified};
 });
 return {items,hasMore,offset,limit};
}

export async function getPartRequests(profileId:string):Promise<PartRequest[]>{
 return (await getPartRequestsPage(profileId,{limit:60})).items;
}
