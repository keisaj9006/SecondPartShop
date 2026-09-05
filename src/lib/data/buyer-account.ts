import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getListings } from "@/lib/data/marketplace";
import type { Listing,SavedSearch } from "@/lib/types";

const safeParams=(value:unknown):Record<string,string>=>{
 if(typeof value!=="object"||value===null||Array.isArray(value))return {};
 const allowed=new Set(["q","category","condition","sort","min","max","pc","collection","vehicle","vr","cv","cy","cf","ce"]);
 const result:Record<string,string>={};
 for(const [key,item] of Object.entries(value as Record<string,unknown>)){
  if(allowed.has(key)&&typeof item==="string"&&item.length<=200)result[key]=item;
 }
 return result;
};

export async function getSavedSearches(profileId:string):Promise<SavedSearch[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("saved_searches")
  .select("id,name,search_params,created_at")
  .eq("profile_id",profileId)
  .order("created_at",{ascending:false});
 if(error)throw error;
 return (data??[]).map(row=>({id:row.id,name:row.name,params:safeParams(row.search_params),createdAt:row.created_at}));
}

export async function getRecentlyViewedListings(profileId:string,limit=12):Promise<Listing[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("recently_viewed_parts")
  .select("part_id,viewed_at")
  .eq("profile_id",profileId)
  .order("viewed_at",{ascending:false})
  .limit(Math.max(1,Math.min(limit,30)));
 if(error)throw error;
 const ids=(data??[]).map(row=>row.part_id);
 if(!ids.length)return [];
 const listings=await getListings({ids});
 const byId=new Map(listings.data.map(item=>[item.id,item]));
 return ids.map(id=>byId.get(id)).filter((item):item is Listing=>Boolean(item));
}

export async function getBuyerAccountCounts(profileId:string){
 const supabase=await createSupabaseServerClient();
 const [savedParts,savedSearches,garage,requests,recent,notifications]=await Promise.all([
  supabase.from("saved_parts").select("part_id",{count:"exact",head:true}).eq("profile_id",profileId),
  supabase.from("saved_searches").select("id",{count:"exact",head:true}).eq("profile_id",profileId),
  supabase.from("garage_vehicles").select("id",{count:"exact",head:true}).eq("profile_id",profileId),
  supabase.from("part_requests").select("id",{count:"exact",head:true}).eq("profile_id",profileId).eq("status","open"),
  supabase.from("recently_viewed_parts").select("part_id",{count:"exact",head:true}).eq("profile_id",profileId),
  supabase.from("notifications").select("id",{count:"exact",head:true}).eq("profile_id",profileId).is("read_at",null)
 ]);
 return {
  savedParts:savedParts.count??0,
  savedSearches:savedSearches.count??0,
  garage:garage.count??0,
  openRequests:requests.count??0,
  recentlyViewed:recent.count??0,
  unreadNotifications:notifications.count??0
 };
}
