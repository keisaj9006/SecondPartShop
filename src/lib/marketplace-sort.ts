import type { Listing,MarketplaceSort } from "@/lib/types";

export function sortMarketplaceListings(listings:Listing[],sort:MarketplaceSort="best"){
 if(sort==="best")return listings;
 const copy=[...listings];
 const infinity=Number.POSITIVE_INFINITY;
 switch(sort){
  case "price_asc":
   return copy.sort((a,b)=>a.pricePence-b.pricePence);
  case "price_desc":
   return copy.sort((a,b)=>b.pricePence-a.pricePence);
  case "distance":
   return copy.sort((a,b)=>(a.distanceMiles??infinity)-(b.distanceMiles??infinity)||a.pricePence-b.pricePence);
  case "delivery":
   return copy.sort((a,b)=>(a.deliveryDaysMin??infinity)-(b.deliveryDaysMin??infinity)||(a.deliveryDaysMax??infinity)-(b.deliveryDaysMax??infinity)||a.pricePence-b.pricePence);
  case "warranty":
   return copy.sort((a,b)=>b.warrantyDays-a.warrantyDays||a.pricePence-b.pricePence);
 }
}
