import type { Listing } from "@/lib/types";

export type OfferGroup={
 key:string;
 kind:"oem"|"part";
 number:string;
 listings:Listing[];
};

export const normalizeComparablePartNumber=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,"");

export function groupListingsForOffers(listings:Listing[]):OfferGroup[]{
 const groups=new Map<string,OfferGroup>();
 const singles:OfferGroup[]=[];
 for(const listing of listings){
  const source=listing.oemNumber?{kind:"oem" as const,number:listing.oemNumber}:listing.partNumber?{kind:"part" as const,number:listing.partNumber}:null;
  if(!source){
   singles.push({key:"listing:"+listing.id,kind:"part",number:"",listings:[listing]});
   continue;
  }
  const normalized=normalizeComparablePartNumber(source.number);
  if(!normalized){
   singles.push({key:"listing:"+listing.id,kind:source.kind,number:source.number,listings:[listing]});
   continue;
  }
  const manufacturerKey=source.kind==="part"?normalizeComparablePartNumber(listing.manufacturer??""):"";
  const key=source.kind+":"+manufacturerKey+":"+normalized;
  const existing=groups.get(key);
  if(existing)existing.listings.push(listing);
  else groups.set(key,{key,kind:source.kind,number:source.number,listings:[listing]});
 }
 return [...groups.values(),...singles].map(group=>({...group,listings:[...group.listings].sort((a,b)=>a.pricePence-b.pricePence)}));
}
