import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublicMemberProfile,ReviewDirection,SellerType,TransactionReview } from "@/lib/types";

type PublicProfileRow={
  profile_id:string;
  handle:string;
  display_name:string;
  bio:string|null;
  member_since:string;
  seller_id:string|null;
  seller_slug:string|null;
  seller_name:string|null;
  seller_type:string|null;
  seller_verified:boolean;
  sold_count:number;
  bought_count:number;
  seller_rating:number|null;
  seller_review_count:number;
  buyer_rating:number|null;
  buyer_review_count:number;
};

const mapProfile=(row:PublicProfileRow):PublicMemberProfile=>({
  id:row.profile_id,
  handle:row.handle,
  displayName:row.display_name,
  bio:row.bio,
  memberSince:row.member_since,
  sellerId:row.seller_id,
  sellerSlug:row.seller_slug,
  sellerName:row.seller_name,
  sellerType:(row.seller_type as SellerType|null)??null,
  sellerVerified:Boolean(row.seller_verified),
  soldCount:Number(row.sold_count??0),
  boughtCount:Number(row.bought_count??0),
  sellerRating:row.seller_rating===null?null:Number(row.seller_rating),
  sellerReviewCount:Number(row.seller_review_count??0),
  buyerRating:row.buyer_rating===null?null:Number(row.buyer_rating),
  buyerReviewCount:Number(row.buyer_review_count??0)
});

export async function getPublicMemberProfile(handle:string):Promise<PublicMemberProfile|null>{
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.rpc("get_public_member_profile",{p_handle:handle});
  if(error)throw new Error("Public member profile is temporarily unavailable.");
  const row=(data?.[0]??null) as PublicProfileRow|null;
  return row?mapProfile(row):null;
}

export async function getPublicMemberProfileById(profileId:string|null):Promise<PublicMemberProfile|null>{
  if(!profileId)return null;
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.rpc("get_public_member_profile_by_id",{p_profile_id:profileId});
  if(error)throw new Error("Public member profile is temporarily unavailable.");
  const row=(data?.[0]??null) as PublicProfileRow|null;
  return row?mapProfile(row):null;
}

export async function getPublicMemberReviews(profileId:string,limit=20):Promise<TransactionReview[]>{
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.rpc("get_public_member_reviews",{p_profile_id:profileId,p_limit:limit});
  if(error)throw new Error("Reviews are temporarily unavailable.");
  return (data??[]).map(row=>({
    id:row.review_id,
    reviewerHandle:row.reviewer_handle,
    reviewerDisplayName:row.reviewer_display_name,
    reviewerSoldCount:Number(row.reviewer_sold_count??0),
    reviewerBoughtCount:Number(row.reviewer_bought_count??0),
    direction:row.direction as ReviewDirection,
    overallRating:Number(row.overall_rating),
    itemAsDescribedRating:row.item_as_described_rating===null?null:Number(row.item_as_described_rating),
    dispatchRating:row.dispatch_rating===null?null:Number(row.dispatch_rating),
    communicationRating:row.communication_rating===null?null:Number(row.communication_rating),
    buyerConductRating:row.buyer_conduct_rating===null?null:Number(row.buyer_conduct_rating),
    comment:row.comment,
    createdAt:row.created_at,
    partTitle:row.part_title
  }));
}
