"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { cleanupFailedCaseEvidenceUpload } from "@/lib/case-evidence-cleanup";
import { validateImageUpload, type ValidatedImageUpload } from "@/lib/image-upload";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function uploadCaseEvidence(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/account");
 const caseId=String(formData.get("caseId")??"");
 const files=formData.getAll("evidence").filter((value):value is File=>value instanceof File&&value.size>0);
 if(!files.length)return {status:"error",message:"Choose at least one evidence image."};
 if(files.length>5)return {status:"error",message:"Upload up to 5 evidence images at a time."};

 const validated:ValidatedImageUpload[]=[];
 try{
  // Validate the entire batch before creating any Storage objects.
  for(const file of files)validated.push(await validateImageUpload(file));
 }catch(error){
  return {status:"error",message:error instanceof Error?error.message:"Choose a valid evidence image."};
 }

 const supabase=await createSupabaseServerClient();
 for(const [index,file] of files.entries()){
  const {extension,mimeType}=validated[index];

  const path=`${caseId}/${user.id}/${randomUUID()}.${extension}`;
  const bytes=new Uint8Array(await file.arrayBuffer());
  const {error:uploadError}=await supabase.storage.from("case-evidence").upload(path,bytes,{
   contentType:mimeType,
   cacheControl:"3600",
   upsert:false
  });
  if(uploadError)return {status:"error",message:"One of the evidence images could not be uploaded."};

  const {error:registerError}=await supabase.rpc("register_transaction_case_evidence",{
   p_case_id:caseId,
   p_storage_path:path,
   p_original_name:file.name.slice(0,255)||("evidence."+extension),
   p_mime_type:mimeType
  });
  if(registerError){
   await cleanupFailedCaseEvidenceUpload(user.id,caseId,path);
   return {status:"error",message:registerError.message.includes("maximum")?"This case already has the maximum number of evidence images.":"The evidence image could not be attached to this case."};
  }
 }

 revalidatePath("/account/cases");
 revalidatePath("/dashboard/cases");
 revalidatePath("/admin/commerce");
 return {status:"success",message:"Evidence uploaded securely."};
}
