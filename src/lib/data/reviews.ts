import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReviewDirection,ReviewOpportunity } from "@/lib/types";

export async function getReviewOpportunities():Promise<ReviewOpportunity[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("get_review_opportunities");
 if(error)throw new Error("Review opportunities are temporarily unavailable.");
 return (data??[]).map(row=>({
  orderItemId:row.order_item_id,
  direction:row.direction as ReviewDirection,
  counterpartProfileId:row.counterpart_profile_id,
  counterpartHandle:row.counterpart_handle,
  counterpartDisplayName:row.counterpart_display_name,
  partTitle:row.part_title,
  fundsReleasedAt:row.funds_released_at,
  existingReviewId:row.existing_review_id??null
 }));
}
