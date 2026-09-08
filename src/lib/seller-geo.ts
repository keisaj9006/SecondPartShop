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


const milesBetween=(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number})=>{
 const toRad=(value:number)=>value*Math.PI/180;
 const earthMiles=3958.7613;
 const dLat=toRad(b.latitude-a.latitude);
 const dLon=toRad(b.longitude-a.longitude);
 const lat1=toRad(a.latitude);
 const lat2=toRad(b.latitude);
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 return earthMiles*2*Math.asin(Math.sqrt(h));
};

export async function getSellerDistanceFromPostcode(sellerId:string,buyerPostcode:string|null|undefined){
 if(!buyerPostcode)return null;
 const buyer=await lookupPostcodeLocation(buyerPostcode);
 if(!buyer)return null;

 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("sellers")
  .select("latitude,longitude,postcode_geocode_approximate")
  .eq("id",sellerId)
  .maybeSingle();
 if(error||data?.latitude===null||data?.longitude===null||data?.latitude===undefined||data?.longitude===undefined)return null;

 return {
  miles:Math.round(milesBetween(buyer,{latitude:data.latitude,longitude:data.longitude})*10)/10,
  approximate:Boolean(data.postcode_geocode_approximate)
 };
}
