import type { Listing } from "@/lib/types";

export const toPublicListing=(listing:Listing):Listing=>({
 ...listing,
 seller:{
  ...listing.seller,
  postcode:null
 }
});
