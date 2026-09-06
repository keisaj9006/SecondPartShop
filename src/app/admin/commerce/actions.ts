"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { refundTransactionCase } from "@/lib/commerce-refunds";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const revalidateCases=()=>{
 revalidatePath("/admin/commerce");
 revalidatePath("/account/cases");
 revalidatePath("/account/orders");
 revalidatePath("/dashboard/cases");
 revalidatePath("/dashboard/orders");
};

export async function rejectTransactionCase(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireAdmin("/admin/commerce");
 const caseId=String(formData.get("caseId")??"");
 const notes=String(formData.get("notes")??"").trim();
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("admin_reject_transaction_case",{p_case_id:caseId,p_notes:notes});
 if(error)return {status:"error",message:"We could not close this case right now."};
 revalidateCases();
 return {status:"success",message:"Case closed without a refund. Any eligible blocked payout can resume."};
}

export async function approveFullRefund(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireAdmin("/admin/commerce");
 const caseId=String(formData.get("caseId")??"");
 const notes=String(formData.get("notes")??"").trim();
 const supabase=await createSupabaseServerClient();

 const {error:gateError}=await supabase.rpc("admin_prepare_transaction_case_refund",{p_case_id:caseId,p_notes:notes});
 if(gateError)return {status:"error",message:"This case is not available for refund review."};

 try{
  const result=await refundTransactionCase(caseId);
  if(!result.refunded){
   revalidateCases();
   return {status:"error",message:result.reason==="stripe_not_configured"?"Stripe refund processing is not configured yet.":"The refund could not be completed."};
  }
  revalidateCases();
  return {status:"success",message:"Full refund completed and the transaction case is resolved."};
 }catch{
  revalidateCases();
  return {status:"error",message:"Refund processing failed safely. The case remains under review and the payout stays blocked."};
 }
}
