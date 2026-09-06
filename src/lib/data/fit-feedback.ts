import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FitFeedbackOpportunity,FitFeedbackResult } from "@/lib/types";

const isResult=(value:string|null):value is FitFeedbackResult=>
 value==="exact_fit"||value==="fit_with_modification"||value==="did_not_fit"||value==="not_installed";

const mapFit=(row:{
 order_item_id:string;
 part_id:string;
 part_title:string;
 part_slug:string;
 variant_id:string;
 vehicle_make:string;
 vehicle_model:string;
 vehicle_variant:string;
 vehicle_year:number;
 vehicle_fuel:string|null;
 vehicle_engine:number|null;
 existing_result:string|null;
 existing_notes:string|null;
 funds_released_at:string;
}):FitFeedbackOpportunity=>({
 orderItemId:row.order_item_id,
 partId:row.part_id,
 partTitle:row.part_title,
 partSlug:row.part_slug,
 variantId:row.variant_id,
 vehicleMake:row.vehicle_make,
 vehicleModel:row.vehicle_model,
 vehicleVariant:row.vehicle_variant,
 vehicleYear:Number(row.vehicle_year),
 vehicleFuel:row.vehicle_fuel,
 vehicleEngine:row.vehicle_engine===null?null:Number(row.vehicle_engine),
 existingResult:isResult(row.existing_result)?row.existing_result:null,
 existingNotes:row.existing_notes,
 fundsReleasedAt:row.funds_released_at
});

export async function getFitFeedbackOpportunitiesPage(options:{offset?:number;limit?:number}={}){
 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??30),60));
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("get_verified_fit_opportunities_page",{p_limit:limit,p_offset:offset});
 if(error)throw new Error("Verified fit feedback is temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>limit;
 return {items:raw.slice(0,limit).map(mapFit),hasMore,offset,limit};
}

export async function getFitFeedbackOpportunities():Promise<FitFeedbackOpportunity[]>{
 return (await getFitFeedbackOpportunitiesPage({limit:60})).items;
}
