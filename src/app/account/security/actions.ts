"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function requestAccountDeletion(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/account/security");
 const reason=String(formData.get("reason")??"").trim().slice(0,500)||null;
 const supabase=await createSupabaseServerClient();
 const {data:existing,error:readError}=await supabase
  .from("account_deletion_requests")
  .select("id,status")
  .eq("profile_id",user.id)
  .eq("status","requested")
  .maybeSingle();
 if(readError)return {status:"error",message:"We could not check your account request right now."};
 if(existing)return {status:"success",message:"Your account deletion request is already pending."};
 const {error}=await supabase.from("account_deletion_requests").insert({profile_id:user.id,reason,status:"requested"});
 if(error)return {status:"error",message:"We could not submit the deletion request right now."};
 revalidatePath("/account/security");
 return {status:"success",message:"Account deletion request submitted. Your account remains active until the request is processed."};
}

export async function cancelAccountDeletion(){
 const user=await requireUser("/account/security");
 const supabase=await createSupabaseServerClient();
 await supabase
  .from("account_deletion_requests")
  .update({status:"cancelled",updated_at:new Date().toISOString()})
  .eq("profile_id",user.id)
  .eq("status","requested");
 revalidatePath("/account/security");
}
