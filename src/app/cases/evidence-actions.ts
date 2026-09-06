"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const allowed=new Map([
 ["image/jpeg","jpg"],
 ["image/png","png"],
 ["image/webp","webp"]
]);

export async function uploadCaseEvidence(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/account");
 const caseId=String(formData.get("caseId")??"");
 const files=formData.getAll("evidence").filter((value):value is File=>value instanceof File&&value.size>0);
 if(!files.length)return {status:"error",message:"Choose at least one evidence image."};
 if(files.length>5)return {status:"error",message:"Upload up to 5 evidence images at a time."};

 const supabase=await createSupabaseServerClient();
 for(const file of files){
  const extension=allowed.get(file.type);
  if(!extension)return {status:"error",message:"Evidence must be JPG, PNG or WebP."};
  if(file.size>5*1024*1024)return {status:"error",message:"Each evidence image must be 5 MB or smaller."};

  const path=`${caseId}/${user.id}/${randomUUID()}.${extension}`;
  const bytes=new Uint8Array(await file.arrayBuffer());
  const {error:uploadError}=await supabase.storage.from("case-evidence").upload(path,bytes,{
   contentType:file.type,
   cacheControl:"3600",
   upsert:false
  });
  if(uploadError)return {status:"error",message:"One of the evidence images could not be uploaded."};

  const {error:registerError}=await supabase.rpc("register_transaction_case_evidence",{
   p_case_id:caseId,
   p_storage_path:path,
   p_original_name:file.name.slice(0,255)||("evidence."+extension),
   p_mime_type:file.type
  });
  if(registerError){
   const admin=createSupabaseAdminClient();
   await admin.storage.from("case-evidence").remove([path]);
   return {status:"error",message:registerError.message.includes("maximum")?"This case already has the maximum number of evidence images.":"The evidence image could not be attached to this case."};
  }
 }

 revalidatePath("/account/cases");
 revalidatePath("/dashboard/cases");
 revalidatePath("/admin/commerce");
 return {status:"success",message:"Evidence uploaded securely."};
}
