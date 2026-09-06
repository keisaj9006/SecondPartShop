"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeRegistration } from "@/lib/vehicle-registration";
import { csvBoolean,parseCsv } from "@/lib/csv";

export type BulkImportIssue={row:number;message:string};
export type BulkImportPreviewRow={
 row:number;
 title:string;
 category:string;
 priceGbp:string;
 sellerReference:string|null;
 donorRegistration:string|null;
};
export type BulkImportState={
 status:"idle"|"preview"|"success"|"error";
 message?:string;
 rowsReceived?:number;
 validRows?:number;
 rejectedRows?:number;
 issues?:BulkImportIssue[];
 sample?:BulkImportPreviewRow[];
 batchId?:string;
};

const MAX_FILE_BYTES=2*1024*1024;
const MAX_ROWS=500;
const REQUIRED_HEADERS=["title","description","category","price_gbp"] as const;
const CONDITIONS=new Set(["used","new","reconditioned"]);
const TESTING=new Set(["tested_working","removed_from_running_vehicle","visually_inspected","untested","not_specified"]);

const text=(value:string|undefined,max=500)=>value?.trim().slice(0,max)??"";
const nullable=(value:string|undefined,max=500)=>{const result=text(value,max);return result||null;};
const moneyPence=(value:string|undefined)=>{if(value===undefined||value.trim()==="")return null;const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?Math.round(parsed*100):null;};
const integer=(value:string|undefined,defaultValue:number)=>{if(value===undefined||value.trim()==="")return defaultValue;const parsed=Number(value);return Number.isInteger(parsed)?parsed:null;};
const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);

type ValidatedRow={
 row:number;
 title:string;
 description:string;
 categoryId:string;
 condition:"used"|"new"|"reconditioned";
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
 donorVehicleId:string|null;
 sellerReference:string|null;
};

async function validateCsv(file:File,sellerId:string){
 if(!file.size)return {fatal:"Choose a CSV file.",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:0};
 if(file.size>MAX_FILE_BYTES)return {fatal:"CSV files can be up to 2 MB in this first bulk-import version.",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:0};
 if(!file.name.toLowerCase().endsWith(".csv"))return {fatal:"Choose a .csv file.",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:0};

 const parsed=parseCsv(await file.text());
 const missing=REQUIRED_HEADERS.filter(header=>!parsed.headers.includes(header));
 if(missing.length)return {fatal:"Missing required columns: "+missing.join(", ")+".",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:parsed.rows.length};
 if(parsed.rows.length>MAX_ROWS)return {fatal:"This CSV contains "+parsed.rows.length+" rows. Import up to "+MAX_ROWS+" rows per file.",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:parsed.rows.length};
 if(!parsed.rows.length)return {fatal:"The CSV does not contain any inventory rows.",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:0};

 const supabase=await createSupabaseServerClient();
 const {data:categories,error:categoryError}=await supabase.from("categories").select("id,name,slug,is_selectable,is_transmission_related").eq("is_selectable",true);
 if(categoryError)return {fatal:"Categories could not be loaded.",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:parsed.rows.length};

 const categoryById=new Map((categories??[]).map(category=>[category.id,category] as const));
 const categoryBySlug=new Map((categories??[]).map(category=>[category.slug.toLowerCase(),category] as const));
 const categoryByName=new Map<string,typeof categories>();
 for(const category of categories??[]){
  const key=category.name.trim().toLowerCase();
  const list=categoryByName.get(key)??[];
  list.push(category);
  categoryByName.set(key,list);
 }

 const donorRegs=[...new Set(parsed.rows.map(row=>text(row.donor_registration,16)).filter(Boolean).map(normalizeRegistration))];
 let donors:Array<{id:string;registration:string|null}>=[];
 if(donorRegs.length){
  const {data,error}=await supabase.from("donor_vehicles").select("id,registration").eq("seller_id",sellerId).in("registration",donorRegs);
  if(error)return {fatal:"Donor vehicles could not be checked.",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:parsed.rows.length};
  donors=data??[];
 }
 const donorByReg=new Map(donors.filter(d=>d.registration).map(d=>[normalizeRegistration(d.registration!),d.id] as const));

 const references=[...new Set(parsed.rows.map(row=>text(row.seller_reference,120)).filter(Boolean))];
 const existingReferences=new Set<string>();
 if(references.length){
  const {data,error}=await supabase.from("parts").select("source_external_id").eq("seller_id",sellerId).eq("source_channel","csv").in("source_external_id",references);
  if(error)return {fatal:"Existing seller references could not be checked.",rows:[] as ValidatedRow[],issues:[] as BulkImportIssue[],sample:[] as BulkImportPreviewRow[],received:parsed.rows.length};
  for(const item of data??[])if(item.source_external_id)existingReferences.add(item.source_external_id.toLowerCase());
 }

 const issues:BulkImportIssue[]=[];
 const valid:ValidatedRow[]=[];
 const sample:BulkImportPreviewRow[]=[];
 const seenRefs=new Set<string>();

 for(let index=0;index<parsed.rows.length;index+=1){
  const rowNumber=index+2;
  const row=parsed.rows[index];
  const rowIssues:string[]=[];
  const title=text(row.title,200);
  const description=text(row.description,5000);
  const categoryInput=text(row.category,160);
  const pricePence=moneyPence(row.price_gbp);
  const shippingPence=moneyPence(row.shipping_gbp)??0;
  const stock=integer(row.stock,1);
  const dispatchDays=integer(row.dispatch_days,2);
  const warrantyDays=integer(row.warranty_days,0);
  const deliveryMinRaw=text(row.delivery_days_min,8);
  const deliveryMaxRaw=text(row.delivery_days_max,8);
  const deliveryDaysMin=deliveryMinRaw?integer(deliveryMinRaw,0):null;
  const deliveryDaysMax=deliveryMaxRaw?integer(deliveryMaxRaw,0):null;
  const condition=(text(row.condition,40)||"used").toLowerCase();
  const testingStatus=(text(row.testing_status,80)||"not_specified").toLowerCase();
  const collectionAvailable=csvBoolean(row.collection_available??"",false);
  const sellerReference=nullable(row.seller_reference,120);
  const donorRegistration=nullable(row.donor_registration,16);
  const normalizedDonor=donorRegistration?normalizeRegistration(donorRegistration):null;

  let category=categoryById.get(categoryInput)??categoryBySlug.get(categoryInput.toLowerCase());
  if(!category){
   const named=categoryByName.get(categoryInput.toLowerCase())??[];
   if(named.length===1)category=named[0];
   else if(named.length>1)rowIssues.push("Category name is ambiguous. Use the category slug instead.");
   else rowIssues.push("Category was not found. Use an exact selectable category slug.");
  }

  if(title.length<5)rowIssues.push("Title must contain at least 5 characters.");
  if(description.length<20)rowIssues.push("Description must contain at least 20 characters.");
  if(pricePence===null)rowIssues.push("price_gbp must be a valid non-negative amount.");
  if(shippingPence===null||shippingPence>1000000)rowIssues.push("shipping_gbp must be between £0 and £10,000.");
  if(stock===null||stock<0||stock>100000)rowIssues.push("stock must be a whole number between 0 and 100,000.");
  if(dispatchDays===null||dispatchDays<0||dispatchDays>30)rowIssues.push("dispatch_days must be a whole number between 0 and 30.");
  if(warrantyDays===null||warrantyDays<0||warrantyDays>730)rowIssues.push("warranty_days must be between 0 and 730.");
  if(!CONDITIONS.has(condition))rowIssues.push("condition must be used, new or reconditioned.");
  if(!TESTING.has(testingStatus))rowIssues.push("testing_status is not valid.");
  if(collectionAvailable===null)rowIssues.push("collection_available must be yes/no, true/false or 1/0.");
  if((deliveryDaysMin===null)!==(deliveryDaysMax===null))rowIssues.push("Set both delivery_days_min and delivery_days_max, or leave both blank.");
  if(deliveryDaysMin!==null&&deliveryDaysMax!==null&&(deliveryDaysMin<0||deliveryDaysMax>30||deliveryDaysMin>deliveryDaysMax))rowIssues.push("Delivery range must be between 0 and 30 days.");
  if(donorRegistration&&!donorByReg.has(normalizedDonor!))rowIssues.push("Donor registration is not saved in this seller account.");
  if(category?.is_transmission_related&&(!text(row.gearbox_family,80)||!text(row.gearbox_code,80)))rowIssues.push("Transmission-related categories require gearbox_family and gearbox_code.");
  if(sellerReference){
   const key=sellerReference.toLowerCase();
   if(existingReferences.has(key))rowIssues.push("seller_reference already exists in a previous CSV import.");
   if(seenRefs.has(key))rowIssues.push("seller_reference is duplicated inside this CSV.");
   seenRefs.add(key);
  }

  sample.push({row:rowNumber,title:title||"(missing title)",category:categoryInput||"(missing category)",priceGbp:row.price_gbp??"",sellerReference,donorRegistration});
  if(rowIssues.length){
   for(const message of rowIssues)issues.push({row:rowNumber,message});
   continue;
  }

  valid.push({
   row:rowNumber,
   title,
   description,
   categoryId:category!.id,
   condition:condition as ValidatedRow["condition"],
   pricePence:pricePence!,
   shippingPence:shippingPence!,
   stock:stock!,
   manufacturer:nullable(row.manufacturer,160),
   partNumber:nullable(row.part_number,160),
   oemNumber:nullable(row.oem_number,160),
   gearboxFamily:category!.is_transmission_related?nullable(row.gearbox_family,80):null,
   gearboxCode:category!.is_transmission_related?nullable(row.gearbox_code,80):null,
   dispatchDays:dispatchDays!,
   testingStatus:testingStatus as ValidatedRow["testingStatus"],
   warrantyDays:warrantyDays!,
   conditionNotes:nullable(row.condition_notes,500),
   damageNotes:nullable(row.damage_notes,500),
   collectionAvailable:collectionAvailable!,
   deliveryDaysMin,
   deliveryDaysMax,
   donorVehicleId:normalizedDonor?donorByReg.get(normalizedDonor)??null:null,
   sellerReference
  });
 }

 return {fatal:null,rows:valid,issues,sample:sample.slice(0,8),received:parsed.rows.length};
}

export async function bulkImportCsv(_previous:BulkImportState,formData:FormData):Promise<BulkImportState>{
 const {user}=await requireSeller("/dashboard/import");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return {status:"error",message:"Create your seller profile before importing inventory."};
 const file=formData.get("file");
 if(!(file instanceof File))return {status:"error",message:"Choose a CSV file."};
 const mode=String(formData.get("mode")??"preview");
 const validation=await validateCsv(file,seller.id);
 if(validation.fatal)return {status:"error",message:validation.fatal,rowsReceived:validation.received};

 const validRows=validation.rows.length;
 const rejectedRows=validation.received-validRows;
 if(mode!=="import"){
  return {
   status:"preview",
   message:validRows+" rows are ready to import as drafts. "+rejectedRows+" rows need attention.",
   rowsReceived:validation.received,
   validRows,
   rejectedRows,
   issues:validation.issues.slice(0,60),
   sample:validation.sample
  };
 }
 if(!validRows)return {
  status:"error",
  message:"There are no valid rows to import.",
  rowsReceived:validation.received,
  validRows:0,
  rejectedRows,
  issues:validation.issues.slice(0,60),
  sample:validation.sample
 };

 const supabase=await createSupabaseServerClient();
 const {data:batch,error:batchError}=await supabase.from("seller_inventory_imports").insert({
  seller_id:seller.id,
  source_channel:"csv",
  filename:file.name.slice(0,255),
  status:"failed",
  rows_received:validation.received,
  rows_created:0,
  rows_rejected:rejectedRows,
  error_summary:validation.issues.slice(0,100)
 }).select("id").single();
 if(batchError||!batch)return {status:"error",message:"The import batch could not be created."};

 let created=0;
 const runtimeIssues=[...validation.issues];

 const payload=validation.rows.map(row=>({
  seller_id:seller.id,
  category_id:row.categoryId,
  donor_vehicle_id:row.donorVehicleId,
  slug:slugify(row.title)+"-"+crypto.randomUUID().slice(0,8),
  title:row.title,
  description:row.description,
  manufacturer:row.manufacturer,
  part_number:row.partNumber,
  oem_number:row.oemNumber,
  gearbox_family:row.gearboxFamily,
  gearbox_code:row.gearboxCode,
  condition:row.condition,
  price_pence:row.pricePence,
  shipping_pence:row.shippingPence,
  stock:row.stock,
  status:"draft" as const,
  dispatch_days:row.dispatchDays,
  testing_status:row.testingStatus,
  warranty_days:row.warrantyDays,
  condition_notes:row.conditionNotes,
  damage_notes:row.damageNotes,
  collection_available:row.collectionAvailable,
  delivery_days_min:row.deliveryDaysMin,
  delivery_days_max:row.deliveryDaysMax,
  source_channel:"csv",
  source_external_id:row.sellerReference,
  import_batch_id:batch.id
 }));

 for(let start=0;start<payload.length;start+=50){
  const chunk=payload.slice(start,start+50);
  const {error}=await supabase.from("parts").insert(chunk);
  if(!error){created+=chunk.length;continue;}
  for(let index=0;index<chunk.length;index+=1){
   const item=chunk[index];
   const {error:itemError}=await supabase.from("parts").insert(item);
   if(itemError){
    const sourceRow=validation.rows[start+index]?.row??0;
    runtimeIssues.push({row:sourceRow,message:itemError.code==="23505"?"Duplicate seller_reference was rejected.":"Database rejected this row during import."});
   }else created+=1;
  }
 }

 const finalRejected=validation.received-created;
 const finalStatus=created===0?"failed":finalRejected>0?"partial":"completed";
 await supabase.from("seller_inventory_imports").update({
  status:finalStatus,
  rows_created:created,
  rows_rejected:finalRejected,
  error_summary:runtimeIssues.slice(0,100)
 }).eq("id",batch.id).eq("seller_id",seller.id);

 revalidatePath("/dashboard");
 revalidatePath("/dashboard/import");

 return {
  status:created>0?"success":"error",
  message:created+" draft"+(created===1?"":"s")+" imported. "+finalRejected+" row"+(finalRejected===1?"":"s")+" rejected. Nothing was published automatically.",
  rowsReceived:validation.received,
  validRows:created,
  rejectedRows:finalRejected,
  issues:runtimeIssues.slice(0,60),
  sample:validation.sample,
  batchId:batch.id
 };
}
