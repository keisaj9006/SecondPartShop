import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReviewDirection,ReviewOpportunity } from "@/lib/types";

const mapReview=(row:{
 order_item_id:string;
 direction:string;
 counterpart_profile_id:string;
 counterpart_handle:string;
 counterpart_display_name:string;
 part_title:string;
 funds_released_at:string;
 existing_review_id:string|null;
}):ReviewOpportunity=>({
 orderItemId:row.order_item_id,
 direction:row.direction as ReviewDirection,
 counterpartProfileId:row.counterpart_profile_id,
 counterpartHandle:row.counterpart_handle,
 counterpartDisplayName:row.counterpart_display_name,
 partTitle:row.part_title,
 fundsReleasedAt:row.funds_released_at,
 existingReviewId:row.existing_review_id??null
});

export async function getReviewOpportunitiesPage(options:{offset?:number;limit?:number}={}){
 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??30),60));
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("get_review_opportunities_page",{p_limit:limit,p_offset:offset});
 if(error)throw new Error("Review opportunities are temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>limit;
 return {items:raw.slice(0,limit).map(mapReview),hasMore,offset,limit};
}

export async function getReviewOpportunities():Promise<ReviewOpportunity[]>{
 return (await getReviewOpportunitiesPage({limit:60})).items;
}
