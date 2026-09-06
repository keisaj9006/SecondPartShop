import type { Listing } from "@/lib/types";

export type ListingQuality={
 score:number;
 label:"Excellent"|"Strong"|"Needs work";
 missing:string[];
};

export type PassportReadiness=ListingQuality&{
 evidenceSignals:number;
 totalSignals:number;
};

export function getPartPassportReadiness(listing:Listing,catalogueFitmentCount=0):PassportReadiness{
 let score=0;
 const missing:string[]=[];
 let evidenceSignals=0;
 const totalSignals=7;

 if(listing.images.length>=3){score+=20;evidenceSignals+=1;}
 else if(listing.images.length===2){score+=14;evidenceSignals+=1;missing.push("Add a third product photo");}
 else if(listing.images.length===1){score+=8;evidenceSignals+=1;missing.push("Add more product photos");}
 else missing.push("Add real product photos");

 if(listing.oemNumber){score+=15;evidenceSignals+=1;}
 else if(listing.partNumber){score+=10;evidenceSignals+=1;missing.push("Add OE/OEM number if available");}
 else missing.push("Add an OE/OEM or part number");

 if(listing.manufacturer){score+=5;}else missing.push("Add manufacturer / brand");

 if(listing.donorVehicleId){score+=15;evidenceSignals+=1;}
 else missing.push("Attach the donor vehicle if known");

 if(catalogueFitmentCount>0){score+=15;evidenceSignals+=1;}
 else missing.push("Add confirmed vehicle compatibility if known");

 if(listing.testingStatus!=="not_specified"){score+=10;evidenceSignals+=1;}
 else missing.push("State how the part was tested");

 if(listing.conditionNotes||listing.damageNotes){score+=10;evidenceSignals+=1;}
 else missing.push("Add condition / damage disclosure");

 if(listing.description.trim().length>=80)score+=5;
 else missing.push("Add a more detailed description");

 if(listing.deliveryDaysMin!==null&&listing.deliveryDaysMax!==null)score+=3;
 if(listing.warrantyDays>0)score+=2;

 const bounded=Math.min(100,score);
 return {
  score:bounded,
  label:bounded>=85?"Excellent":bounded>=65?"Strong":"Needs work",
  missing:missing.slice(0,4),
  evidenceSignals,
  totalSignals
 };
}

export function getListingQuality(listing:Listing,catalogueFitmentCount=0):ListingQuality{
 const readiness=getPartPassportReadiness(listing,catalogueFitmentCount);
 return {score:readiness.score,label:readiness.label,missing:readiness.missing};
}
