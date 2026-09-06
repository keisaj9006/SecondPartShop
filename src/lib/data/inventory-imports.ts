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
