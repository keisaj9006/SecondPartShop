import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { lookupPostcodeLocation,normalizePostcode } from "@/lib/postcode";

export type SellerGeo={
 postcode:string|null;
 latitude:number|null;
 longitude:number|null;
 postcode_geocode_approximate:boolean;
 postcode_geocoded_at:string|null;
};

export async function sellerGeoFromPostcode(value:string|null|undefined):Promise<SellerGeo>{
 const normalized=value?normalizePostcode(value):"";
 if(!normalized){
  return {
   postcode:null,
   latitude:null,
   longitude:null,
   postcode_geocode_approximate:false,
   postcode_geocoded_at:null
  };
 }

 const geo=await lookupPostcodeLocation(normalized,true);
 return {
  postcode:normalized,
  latitude:geo?.latitude??null,
  longitude:geo?.longitude??null,
  postcode_geocode_approximate:geo?.approximate??false,
  postcode_geocoded_at:geo?new Date().toISOString():null
 };
}

export async function persistSellerGeo(sellerId:string,ownerId:string,geo:SellerGeo){
 const admin=createSupabaseAdminClient();
 const {error}=await admin
  .from("sellers")
  .update({
   latitude:geo.latitude,
   longitude:geo.longitude,
   postcode_geocode_approximate:geo.postcode_geocode_approximate,
   postcode_geocoded_at:geo.postcode_geocoded_at
  })
  .eq("id",sellerId)
  .eq("owner_id",ownerId);
 if(error)throw new Error("Seller location could not be prepared for distance search.");
}


export async function persistSellerGeoAdmin(sellerId:string,geo:SellerGeo){
 const admin=createSupabaseAdminClient();
 const {error}=await admin
  .from("sellers")
  .update({
   latitude:geo.latitude,
   longitude:geo.longitude,
   postcode_geocode_approximate:geo.postcode_geocode_approximate,
   postcode_geocoded_at:geo.postcode_geocoded_at
  })
  .eq("id",sellerId);
 if(error)throw new Error("Seller location could not be prepared for distance search.");
}
