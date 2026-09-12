import { cache } from "react";
import { getListingBySlug,getSellerBySlug } from "@/lib/data/marketplace";

export const getPublicListingBySlug=cache(getListingBySlug);
export const getPublicSellerBySlug=cache(getSellerBySlug);
