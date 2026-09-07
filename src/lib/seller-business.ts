import type { SellerBusinessKind } from "@/lib/types";

export const sellerBusinessKinds:SellerBusinessKind[]=[
 "breaker",
 "garage",
 "atf",
 "parts_business",
 "other"
];

export const sellerBusinessKindLabels:Record<SellerBusinessKind,string>={
 breaker:"Vehicle breaker",
 garage:"Garage / workshop",
 atf:"ATF / vehicle dismantler",
 parts_business:"Parts business / retailer",
 other:"Other automotive business"
};

export const isSellerBusinessKind=(value:string):value is SellerBusinessKind=>
 sellerBusinessKinds.includes(value as SellerBusinessKind);

export const sellerBusinessKindLabel=(value:SellerBusinessKind|null|undefined)=>
 value?sellerBusinessKindLabels[value]:"Business";
