import type { PartCondition,PartRequest } from "@/lib/types";

export type PartRequestResponse={
 requestId:string;
 id:string;
 slug:string;
 title:string;
 pricePence:number;
 condition:PartCondition;
 sellerName:string;
 sellerVerified:boolean;
};

export type PartRequestWithResponses=PartRequest&{
 responses:PartRequestResponse[];
};
