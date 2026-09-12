import "server-only";

import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {isUuid} from "@/lib/identifiers";
import {sanitizeMonitoringText} from "@/lib/ops-monitoring";

type SearchSource="web"|"mobile";

export async function recordMarketplaceSearch(input:{
 source:SearchSource;
 query:string|undefined|null;
 resultCount:number;
 vehicleContext:boolean;
 compatibleOnly:boolean;
 categoryId?:string|null;
}){
 const query=String(input.query??"").replace(/\s+/g," ").trim().slice(0,160);
 if(query.length<2)return;
 const resultCount=Math.max(0,Math.min(1_000_000,Math.floor(Number(input.resultCount)||0)));
 const categoryId=input.categoryId&&isUuid(input.categoryId)?input.categoryId:null;
 try{
  const supabase=createSupabaseAdminClient();
  const {error}=await supabase.from("marketplace_search_events").insert({
   source:input.source,
   query_text:query,
   result_count:resultCount,
   has_results:resultCount>0,
   vehicle_context:Boolean(input.vehicleContext),
   compatible_only:Boolean(input.vehicleContext&&input.compatibleOnly),
   category_id:categoryId
  });
  if(error)console.warn("[SecondPart] Search analytics insert failed",sanitizeMonitoringText(error.code,120));
 }catch(error){
  console.warn("[SecondPart] Search analytics unavailable",sanitizeMonitoringText(error instanceof Error?error.message:"unknown_error",240));
 }
}
