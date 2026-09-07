import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InventoryImportIssue={row:number;message:string};
export type InventoryImportReport={
 id:string;
 filename:string|null;
 status:"completed"|"partial"|"failed";
 rowsReceived:number;
 rowsCreated:number;
 rowsRejected:number;
 issues:InventoryImportIssue[];
 createdAt:string;
};

const issueRows=(value:unknown):InventoryImportIssue[]=>{
 if(!Array.isArray(value))return [];
 return value.flatMap(item=>{
  if(typeof item!=="object"||item===null||Array.isArray(item))return [];
  const row=item as {row?:unknown;message?:unknown};
  const number=Number(row.row);
  const message=typeof row.message==="string"?row.message.trim():"";
  return Number.isInteger(number)&&number>=0&&message?[{row:number,message}]:[];
 });
};

export async function getInventoryImportReport(sellerId:string,id:string):Promise<InventoryImportReport|null>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("seller_inventory_imports")
  .select("id,filename,status,rows_received,rows_created,rows_rejected,error_summary,created_at")
  .eq("id",id)
  .eq("seller_id",sellerId)
  .maybeSingle();
 if(error)throw new Error("Import report is temporarily unavailable.");
 if(!data)return null;
 return {
  id:data.id,
  filename:data.filename,
  status:data.status==="completed"||data.status==="partial"||data.status==="failed"?data.status:"failed",
  rowsReceived:data.rows_received,
  rowsCreated:data.rows_created,
  rowsRejected:data.rows_rejected,
  issues:issueRows(data.error_summary),
  createdAt:data.created_at
 };
}


export type InventoryImportReadiness={
 totalDrafts:number;
 readyDrafts:number;
 needsPhotos:number;
 needsCompatibility:number;
 needsTechnical:number;
 needsStock:number;
};

export async function getInventoryImportReadiness(batchId:string):Promise<InventoryImportReadiness>{
 const supabase=await createSupabaseServerClient();
 const [{data,error},{count:needsStock,error:stockError}]=await Promise.all([
  supabase.rpc("seller_import_batch_readiness",{p_batch_id:batchId}),
  supabase.from("parts").select("id",{count:"exact",head:true}).eq("import_batch_id",batchId).eq("status","draft").lte("stock",0)
 ]);
 if(error||stockError)throw new Error("Import readiness is temporarily unavailable.");
 const row=data?.[0];
 return {
  totalDrafts:Number(row?.total_drafts??0),
  readyDrafts:Number(row?.ready_drafts??0),
  needsPhotos:Number(row?.needs_photos??0),
  needsCompatibility:Number(row?.needs_compatibility??0),
  needsTechnical:Number(row?.needs_technical??0),
  needsStock:needsStock??0
 };
}


export type InventoryImportNeed="all"|"ready"|"photos"|"compatibility"|"technical"|"stock";
export type InventoryImportWorkItem={
 partId:string;
 title:string;
 sellerReference:string|null;
 categoryName:string;
 hasStock:boolean;
 hasPhoto:boolean;
 hasCompatibility:boolean;
 hasTechnical:boolean;
};
export type InventoryImportWorkQueue={
 items:InventoryImportWorkItem[];
 total:number;
 offset:number;
 limit:number;
 hasMore:boolean;
};

export async function getInventoryImportWorkQueue(
 batchId:string,
 need:InventoryImportNeed,
 offset=0,
 limit=25
):Promise<InventoryImportWorkQueue>{
 const safeOffset=Math.max(0,Math.floor(offset));
 const safeLimit=Math.max(1,Math.min(Math.floor(limit),100));
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("seller_import_batch_work_queue",{
  p_batch_id:batchId,
  p_need:need,
  p_limit:safeLimit,
  p_offset:safeOffset
 });
 if(error)throw new Error("Import work queue is temporarily unavailable.");
 const rows=data??[];
 const total=Number(rows[0]?.total_count??0);
 return {
  items:rows.map(row=>({
   partId:row.part_id,
   title:row.title,
   sellerReference:row.source_external_id,
   categoryName:row.category_name,
   hasStock:Boolean(row.has_stock),
   hasPhoto:Boolean(row.has_photo),
   hasCompatibility:Boolean(row.has_compatibility),
   hasTechnical:Boolean(row.has_technical)
  })),
  total,
  offset:safeOffset,
  limit:safeLimit,
  hasMore:safeOffset+rows.length<total
 };
}
