import { randomUUID } from "node:crypto";
import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const allowed=new Map([
 ["image/jpeg","jpg"],
 ["image/png","png"],
 ["image/webp","webp"]
]);

export async function GET(request:Request,{params}:{params:Promise<{caseId:string}>}){
 const {caseId}=await params;
 if(!isUuid(caseId))return mobileJson(request,{ok:false,error:"invalid_case"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const {data:caseRow,error:caseError}=await supabase
  .from("transaction_cases")
  .select("id,status")
  .eq("id",caseId)
  .maybeSingle();
 if(caseError)return mobileJson(request,{ok:false,error:"case_unavailable"},503);
 if(!caseRow)return mobileJson(request,{ok:false,error:"not_found"},404);

 const {data,error}=await supabase
  .from("transaction_case_evidence")
  .select("id,case_id,uploader_profile_id,storage_path,original_name,mime_type,created_at")
  .eq("case_id",caseId)
  .order("created_at",{ascending:true});
 if(error)return mobileJson(request,{ok:false,error:"evidence_unavailable"},503);

 const rows=data??[];
 const urls=await Promise.all(rows.map(row=>supabase.storage.from("case-evidence").createSignedUrl(row.storage_path,600)));

 return mobileJson(request,{
  ok:true,
  caseId,
  canUpload:!["resolved","rejected","cancelled"].includes(caseRow.status),
  count:rows.length,
  items:rows.flatMap((row,index)=>{
   const signedUrl=urls[index].data?.signedUrl;
   if(!signedUrl)return [];
   return [{
    id:row.id,
    uploaderProfileId:row.uploader_profile_id,
    mine:row.uploader_profile_id===user.id,
    originalName:row.original_name,
    mimeType:row.mime_type,
    signedUrl,
    createdAt:row.created_at
   }];
  })
 });
}

export async function POST(request:Request,{params}:{params:Promise<{caseId:string}>}){
 const {caseId}=await params;
 if(!isUuid(caseId))return mobileJson(request,{ok:false,error:"invalid_case"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 let form:FormData;
 try{form=await request.formData();}catch{return mobileJson(request,{ok:false,error:"invalid_form"},400);}
 const file=form.get("file");
 if(!(file instanceof File)||file.size<=0)return mobileJson(request,{ok:false,error:"file_required"},400);

 const extension=allowed.get(file.type);
 if(!extension)return mobileJson(request,{ok:false,error:"unsupported_file_type"},400);
 if(file.size>5*1024*1024)return mobileJson(request,{ok:false,error:"file_too_large"},413);

 const {data:caseRow,error:caseError}=await supabase
  .from("transaction_cases")
  .select("id,status")
  .eq("id",caseId)
  .maybeSingle();
 if(caseError)return mobileJson(request,{ok:false,error:"case_unavailable"},503);
 if(!caseRow)return mobileJson(request,{ok:false,error:"not_found"},404);
 if(["resolved","rejected","cancelled"].includes(caseRow.status))return mobileJson(request,{ok:false,error:"case_closed"},409);

 const {count,error:countError}=await supabase
  .from("transaction_case_evidence")
  .select("id",{count:"exact",head:true})
  .eq("case_id",caseId);
 if(countError)return mobileJson(request,{ok:false,error:"evidence_unavailable"},503);
 if((count??0)>=10)return mobileJson(request,{ok:false,error:"evidence_limit"},409);

 const storagePath=`${caseId}/${user.id}/${randomUUID()}.${extension}`;
 const bytes=new Uint8Array(await file.arrayBuffer());
 const {error:uploadError}=await supabase.storage.from("case-evidence").upload(storagePath,bytes,{
  contentType:file.type,
  cacheControl:"3600",
  upsert:false
 });
 if(uploadError)return mobileJson(request,{ok:false,error:"evidence_upload_failed"},503);

 const {data:evidenceId,error:registerError}=await supabase.rpc("register_transaction_case_evidence",{
  p_case_id:caseId,
  p_storage_path:storagePath,
  p_original_name:(file.name||("evidence."+extension)).slice(0,255),
  p_mime_type:file.type
 });
 if(registerError){
  const admin=createSupabaseAdminClient();
  await admin.storage.from("case-evidence").remove([storagePath]);
  const code=registerError.message.toLowerCase().includes("maximum")?"evidence_limit":"evidence_attach_failed";
  return mobileJson(request,{ok:false,error:code},409);
 }

 return mobileJson(request,{ok:true,evidenceId},201);
}
