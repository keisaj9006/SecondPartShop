import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type MobileListingWriteInput={
 title:string;
 description:string;
 categoryId:string;
 donorVehicleId:string|null;
 condition:"new"|"reconditioned"|"used";
 pricePence:number;
 shippingPence:number;
 stock:number;
 manufacturer:string|null;
 partNumber:string|null;
 oemNumber:string|null;
 gearboxFamily:string|null;
 gearboxCode:string|null;
 dispatchDays:number;
 testingStatus:"tested_working"|"removed_from_running_vehicle"|"visually_inspected"|"untested"|"not_specified";
 warrantyDays:number;
 conditionNotes:string|null;
 damageNotes:string|null;
 collectionAvailable:boolean;
 deliveryDaysMin:number|null;
 deliveryDaysMax:number|null;
 catalogueFitments:CatalogueFitmentInput[]|null;
};

type CatalogueFitmentInput={
 variant_id:string;
 year_value:number;
 fuel_type:string|null;
 engine_size_simple:number|null;
 notes:string|null;
};

type Db=SupabaseClient<Database>;

const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const nullable=(value:unknown,max:number)=>text(value,max)||null;
const integerOrNull=(value:unknown)=>{
 if(value===null||value===undefined||value==="")return null;
 const parsed=Number(value);
 return Number.isInteger(parsed)?parsed:null;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseFitments=(value:unknown):CatalogueFitmentInput[]|null=>{
 if(value===undefined)return null;
 if(!Array.isArray(value)||value.length>20)throw new Error("invalid_fitments");
 const seen=new Set<string>();
 return value.map(raw=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("invalid_fitments");
  const row=raw as Record<string,unknown>;
  const variantId=text(row.variantId,80);
  const year=Number(row.year);
  const fuel=nullable(row.fuelType,100);
  const engine=integerOrNull(row.engineSizeSimple);
  const notes=nullable(row.notes,300);
  if(!uuid.test(variantId)||!Number.isInteger(year)||year<1900||year>2100)throw new Error("invalid_fitments");
  if(engine!==null&&(engine<100||engine>10000))throw new Error("invalid_fitments");
  const key=[variantId,year,fuel??"",engine??""].join("|");
  if(seen.has(key))throw new Error("duplicate_fitment");
  seen.add(key);
  return {variant_id:variantId,year_value:year,fuel_type:fuel,engine_size_simple:engine,notes};
 });
};

export const parseMobileListingInput=(body:unknown):MobileListingWriteInput=>{
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const condition=String(input.condition??"used");
 const testing=String(input.testingStatus??"not_specified");
 const pricePence=Math.round(Number(input.pricePence));
 const shippingPence=Math.round(Number(input.shippingPence??0));
 const stock=Math.floor(Number(input.stock??1));
 const dispatchDays=Math.floor(Number(input.dispatchDays??2));
 const warrantyDays=Math.floor(Number(input.warrantyDays??0));
 const minDays=integerOrNull(input.deliveryDaysMin);
 const maxDays=integerOrNull(input.deliveryDaysMax);
 const donorId=text(input.donorVehicleId,80)||null;

 if(!["new","reconditioned","used"].includes(condition))throw new Error("invalid_condition");
 if(!["tested_working","removed_from_running_vehicle","visually_inspected","untested","not_specified"].includes(testing))throw new Error("invalid_testing");
 if(!Number.isInteger(pricePence)||pricePence<0||pricePence>100000000)throw new Error("invalid_price");
 if(!Number.isInteger(shippingPence)||shippingPence<0||shippingPence>1000000)throw new Error("invalid_shipping");
 if(!Number.isInteger(stock)||stock<0||stock>100000)throw new Error("invalid_stock");
 if(!Number.isInteger(dispatchDays)||dispatchDays<0||dispatchDays>30)throw new Error("invalid_dispatch");
 if(!Number.isInteger(warrantyDays)||warrantyDays<0||warrantyDays>730)throw new Error("invalid_warranty");
 if((minDays===null)!==(maxDays===null))throw new Error("invalid_delivery_range");
 if(minDays!==null&&maxDays!==null&&(minDays<0||maxDays>30||minDays>maxDays))throw new Error("invalid_delivery_range");
 if(donorId&&!uuid.test(donorId))throw new Error("invalid_donor");

 return {
  title:text(input.title,180),
  description:text(input.description,5000),
  categoryId:text(input.categoryId,80),
  donorVehicleId:donorId,
  condition:condition as MobileListingWriteInput["condition"],
  pricePence,
  shippingPence,
  stock,
  manufacturer:nullable(input.manufacturer,160),
  partNumber:nullable(input.partNumber,160),
  oemNumber:nullable(input.oemNumber,160),
  gearboxFamily:nullable(input.gearboxFamily,80),
  gearboxCode:nullable(input.gearboxCode,80),
  dispatchDays,
  testingStatus:testing as MobileListingWriteInput["testingStatus"],
  warrantyDays,
  conditionNotes:nullable(input.conditionNotes,500),
  damageNotes:nullable(input.damageNotes,500),
  collectionAvailable:input.collectionAvailable===true,
  deliveryDaysMin:minDays,
  deliveryDaysMax:maxDays,
  catalogueFitments:parseFitments(input.catalogueFitments)
 };
};

export async function validateMobileListingInput(supabase:Db,sellerId:string,value:MobileListingWriteInput){
 if(value.title.length<5)throw new Error("title_too_short");
 if(value.description.length<20)throw new Error("description_too_short");
 if(!uuid.test(value.categoryId))throw new Error("invalid_category");

 const {data:category,error:categoryError}=await supabase
  .from("categories")
  .select("is_selectable,is_transmission_related")
  .eq("id",value.categoryId)
  .maybeSingle();
 if(categoryError||!category||!category.is_selectable)throw new Error("invalid_category");

 if(category.is_transmission_related&&(!value.gearboxFamily||!value.gearboxCode)){
  throw new Error("transmission_codes_required");
 }

 if(value.donorVehicleId){
  const {data:donor,error}=await supabase
   .from("donor_vehicles")
   .select("id")
   .eq("id",value.donorVehicleId)
   .eq("seller_id",sellerId)
   .maybeSingle();
  if(error||!donor)throw new Error("invalid_donor");
 }

 return category.is_transmission_related
  ?value
  :{...value,gearboxFamily:null,gearboxCode:null};
}

export const listingRow=(value:MobileListingWriteInput)=>({
 title:value.title,
 description:value.description,
 category_id:value.categoryId,
 donor_vehicle_id:value.donorVehicleId,
 condition:value.condition,
 price_pence:value.pricePence,
 shipping_pence:value.shippingPence,
 stock:value.stock,
 manufacturer:value.manufacturer,
 part_number:value.partNumber,
 oem_number:value.oemNumber,
 gearbox_family:value.gearboxFamily,
 gearbox_code:value.gearboxCode,
 dispatch_days:value.dispatchDays,
 testing_status:value.testingStatus,
 warranty_days:value.warrantyDays,
 condition_notes:value.conditionNotes,
 damage_notes:value.damageNotes,
 collection_available:value.collectionAvailable,
 delivery_days_min:value.deliveryDaysMin,
 delivery_days_max:value.deliveryDaysMax
});

export async function replaceMobileListingFitments(supabase:Db,partId:string,fitments:CatalogueFitmentInput[]|null){
 if(fitments===null)return;
 const {error}=await supabase.rpc("replace_part_catalogue_fitments",{p_part_id:partId,p_fitments:fitments});
 if(error)throw new Error(error.message.toLowerCase().includes("invalid")?"invalid_fitments":"fitment_save_failed");
}

export async function canPublishMobileListing(supabase:Db,partId:string,value:MobileListingWriteInput){
 if(value.stock<1)throw new Error("stock_required");
 const [{count:imageCount,error:imageError},{count:fitmentCount,error:fitmentError}]=await Promise.all([
  supabase.from("part_images").select("id",{count:"exact",head:true}).eq("part_id",partId),
  supabase.from("part_catalogue_fitments").select("id",{count:"exact",head:true}).eq("part_id",partId)
 ]);
 if(imageError||fitmentError)throw new Error("publish_check_failed");
 if((imageCount??0)<1)throw new Error("photo_required");
 const evidence=Boolean(
  value.donorVehicleId||
  (fitmentCount??0)>0||
  value.oemNumber||
  (value.manufacturer&&value.partNumber)
 );
 if(!evidence)throw new Error("compatibility_evidence_required");
 return true;
}

export const slugifyMobileListing=(value:string)=>value
 .toLowerCase()
 .normalize("NFKD")
 .replace(/[\u0300-\u036f]/g,"")
 .replace(/[^a-z0-9]+/g,"-")
 .replace(/^-|-$/g,"")
 .slice(0,80);
