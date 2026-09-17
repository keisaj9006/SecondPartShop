import type { PartCondition,PartRequest } from "@/lib/types";

export type PartRequestResponse={
 requestId:string;
 id:string;
 slug:string;
 title:string;
 pricePence:number;
 shippingPence:number;
 totalPence:number;
 dispatchDays:number;
 warrantyDays:number;
 condition:PartCondition;
 sellerName:string;
 sellerVerified:boolean;
};

export type PartRequestWithResponses=PartRequest&{
 responses:PartRequestResponse[];
};
