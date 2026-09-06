import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FitFeedbackOpportunity,FitFeedbackResult } from "@/lib/types";

const isResult=(value:string|null):value is FitFeedbackResult=>
 value==="exact_fit"||value==="fit_with_modification"||value==="did_not_fit"||value==="not_installed";

export async function getFitFeedbackOpportunities():Promise<FitFeedbackOpportunity[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("get_verified_fit_opportunities");
 if(error)throw new Error("Verified fit feedback is temporarily unavailable.");
 return (data??[]).map(row=>({
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
 }));
}
