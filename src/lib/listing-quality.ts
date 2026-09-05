import type { Listing } from "@/lib/types";

export type ListingQuality={
 score:number;
 label:"Excellent"|"Strong"|"Needs work";
 missing:string[];
};

export function getListingQuality(listing:Listing,catalogueFitmentCount=0):ListingQuality{
 let score=0;
 const missing:string[]=[];

 score+=10;
 if(listing.description.trim().length>=80)score+=5;else missing.push("Add a more detailed description");

 if(listing.images.length>=3)score+=20;
 else if(listing.images.length===2){score+=14;missing.push("Add a third product photo");}
 else if(listing.images.length===1){score+=8;missing.push("Add more product photos");}
 else missing.push("Add real product photos");

 if(listing.oemNumber||listing.partNumber)score+=15;else missing.push("Add an OE/OEM or part number");
 if(listing.manufacturer)score+=5;else missing.push("Add manufacturer / brand");

 if(listing.testingStatus!=="not_specified")score+=10;else missing.push("State how the part was tested");
 if(listing.warrantyDays>0)score+=10;else missing.push("Add seller warranty if available");

 if(listing.conditionNotes)score+=5;else missing.push("Add condition notes");
 if(catalogueFitmentCount>0)score+=15;else missing.push("Add confirmed vehicle compatibility");

 if(listing.deliveryDaysMin!==null&&listing.deliveryDaysMax!==null)score+=3;else missing.push("Add delivery estimate");
 if(listing.collectionAvailable)score+=2;

 const bounded=Math.min(100,score);
 return {score:bounded,label:bounded>=85?"Excellent":bounded>=65?"Strong":"Needs work",missing:missing.slice(0,3)};
}
