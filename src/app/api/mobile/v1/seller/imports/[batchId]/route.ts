import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export function OPTIONS(request:Request){return mobileOptions(request);}

const issues=(value:unknown)=>{
 if(!Array.isArray(value))return [];
 return value.flatMap(item=>{
  if(!item||typeof item!=="object"||Array.isArray(item))return [];
  const row=item as {row?:unknown;message?:unknown};
  const number=Number(row.row);
  const message=typeof row.message==="string"?row.message.trim():"";
  return Number.isInteger(number)&&number>=0&&message?[{row:number,message}]:[];
 });
};

export async function GET(request:Request,{params}:{params:Promise<{batchId:string}>}){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const {batchId}=await params;
 if(!isUuid(batchId))return mobileJson(request,{ok:false,error:"invalid_import_batch"},400);

 const [{data:batch,error:batchError},{data:readiness,error:readinessError}]=await Promise.all([
  supabase.from("seller_inventory_imports")
   .select("id,source_channel,filename,status,rows_received,rows_created,rows_rejected,error_summary,created_at")
   .eq("id",batchId)
   .eq("seller_id",auth.seller.id)
   .maybeSingle(),
  supabase.rpc("seller_import_batch_readiness",{p_batch_id:batchId})
 ]);
 if(batchError||readinessError)return mobileJson(request,{ok:false,error:"inventory_import_unavailable"},503);
 if(!batch)return mobileJson(request,{ok:false,error:"inventory_import_not_found"},404);
 const ready=readiness?.[0];
 return mobileJson(request,{ok:true,import:{
  id:batch.id,
  sourceChannel:batch.source_channel,
  filename:batch.filename,
  status:batch.status,
  rowsReceived:batch.rows_received,
  rowsCreated:batch.rows_created,
  rowsRejected:batch.rows_rejected,
  issues:issues(batch.error_summary),
  createdAt:batch.created_at,
  readiness:{
   totalDrafts:Number(ready?.total_drafts??0),
   readyDrafts:Number(ready?.ready_drafts??0),
   needsPhotos:Number(ready?.needs_photos??0),
   needsCompatibility:Number(ready?.needs_compatibility??0),
   needsTechnical:Number(ready?.needs_technical??0)
  }
 }});
}

export async function POST(request:Request,{params}:{params:Promise<{batchId:string}>}){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const {batchId}=await params;
 if(!isUuid(batchId))return mobileJson(request,{ok:false,error:"invalid_import_batch"},400);
 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 if(String(input.action??"")!=="publish_ready")return mobileJson(request,{ok:false,error:"invalid_import_action"},400);

 const {data:owned,error:ownerError}=await supabase.from("seller_inventory_imports").select("id").eq("id",batchId).eq("seller_id",auth.seller.id).maybeSingle();
 if(ownerError)return mobileJson(request,{ok:false,error:"inventory_import_unavailable"},503);
 if(!owned)return mobileJson(request,{ok:false,error:"inventory_import_not_found"},404);

 const {data,error}=await supabase.rpc("publish_ready_import_batch",{p_batch_id:batchId});
 if(error)return mobileJson(request,{ok:false,error:"import_publish_failed"},503);
 return mobileJson(request,{ok:true,published:Number(data??0)});
}
