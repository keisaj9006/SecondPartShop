"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function respondToTransactionCase(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireSeller("/dashboard/cases");
 const caseId=String(formData.get("caseId")??"");
 const response=String(formData.get("response")??"").trim();
 if(response.length<10)return {status:"error",message:"Please add a little more detail."};

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("seller_respond_transaction_case",{
  p_case_id:caseId,
  p_response:response
 });
 if(error)return {status:"error",message:"We could not save your case response right now."};

 revalidatePath("/dashboard/cases");
 revalidatePath("/account/cases");
 return {status:"success",message:"Response sent. The payout remains blocked until the case is resolved."};
}
