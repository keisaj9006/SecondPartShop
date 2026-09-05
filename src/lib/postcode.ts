import "server-only";
import type { Listing } from "@/lib/types";

type PostcodeResponse={status:number;result?:{latitude:number;longitude:number}|null};

export const normalizePostcode=(value:string)=>value.toUpperCase().replace(/\s+/g,"").slice(0,8);
export const isPlausibleUkPostcode=(value:string)=>/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(normalizePostcode(value));

async function lookupPostcode(postcode:string){
 const normalized=normalizePostcode(postcode);
 if(!isPlausibleUkPostcode(normalized))return null;
 try{
  const response=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(normalized)}`,{next:{revalidate:60*60*24*30}});
  if(!response.ok)return null;
  const payload=await response.json() as PostcodeResponse;
  if(!payload.result)return null;
  return {latitude:payload.result.latitude,longitude:payload.result.longitude};
 }catch{
  return null;
 }
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

export async function enrichListingsWithDistance(listings:Listing[],buyerPostcode?:string):Promise<Listing[]>{
 if(!buyerPostcode||!isPlausibleUkPostcode(buyerPostcode)||!listings.length)return listings;
 const buyer=await lookupPostcode(buyerPostcode);
 if(!buyer)return listings;
 const sellerPostcodes=[...new Set(listings.map(item=>item.seller.postcode).filter((value):value is string=>Boolean(value)))];
 const resolved=new Map<string,{latitude:number;longitude:number}|null>();
 await Promise.all(sellerPostcodes.map(async postcode=>resolved.set(postcode,await lookupPostcode(postcode))));
 return listings.map(item=>{
  const sellerPostcode=item.seller.postcode;
  const seller=sellerPostcode?resolved.get(sellerPostcode):null;
  return seller?{...item,distanceMiles:Math.round(milesBetween(buyer,seller)*10)/10}:{...item,distanceMiles:null};
 });
}
