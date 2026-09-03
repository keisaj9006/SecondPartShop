export type Condition = "New" | "Reconditioned" | "Used";
export type Listing = { id:string; slug:string; title:string; category:string; price:number; condition:Condition; code:string; oem:string; compatibility:string[]; seller:{ name:string; location:string; verified:boolean; rating:number }; stock:number; dispatch:string; accent:string; };
