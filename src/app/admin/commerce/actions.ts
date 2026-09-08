"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { refundTransactionCase } from "@/lib/commerce-refunds";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { schedulePushDispatch } from "@/lib/push/schedule";

const revalidateCases=()=>{
 schedulePushDispatch(50);
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
 if(error){const lower=error.message.toLowerCase();if(lower.includes("payment-provider disputes"))return {status:"error",message:"This case is managed by Stripe and closes only when the provider sends its final outcome."};return {status:"error",message:"We could not close this case right now."};}
 revalidateCases();
 return {status:"success",message:"Case closed without a refund. Any eligible blocked payout can resume."};
}

export async function authorizeReturn(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireAdmin("/admin/commerce");
 const caseId=String(formData.get("caseId")??"");
 const notes=String(formData.get("notes")??"").trim();
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("admin_authorize_transaction_return",{p_case_id:caseId,p_notes:notes||undefined});
 if(error)return {status:"error",message:"We could not authorise this return right now."};
 revalidateCases();
 return {status:"success",message:"Return authorised. The buyer can now record the return shipment."};
}

export async function approveFullRefund(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireAdmin("/admin/commerce");
 const caseId=String(formData.get("caseId")??"");
 const notes=String(formData.get("notes")??"").trim();
 const supabase=await createSupabaseServerClient();

 const {error:gateError}=await supabase.rpc("admin_prepare_transaction_case_refund",{p_case_id:caseId,p_notes:notes});
 if(gateError){const lower=gateError.message.toLowerCase();if(lower.includes("payment-provider disputes"))return {status:"error",message:"Do not issue a manual refund while the Stripe dispute is open. Wait for the provider outcome."};return {status:"error",message:"This case is not available for refund review."};}

 try{
  const result=await refundTransactionCase(caseId);
  if(!result.refunded){
   revalidateCases();
   return {status:"error",message:result.reason==="stripe_not_configured"
    ?"Stripe refund processing is not configured yet."
    :result.reason==="provider_dispute_managed"
     ?"This payment-provider dispute must be resolved through Stripe, not a manual marketplace refund."
     :result.reason==="payout_reconciliation_required"
      ?"Refund stopped safely: seller funds were already released, but the payout transfer reference is incomplete. Reconcile the Stripe transfer before retrying this refund."
      :"The refund could not be completed."};
  }
  revalidateCases();
  return {status:"success",message:"Full refund completed and the transaction case is resolved."};
 }catch{
  revalidateCases();
  return {status:"error",message:"Refund processing failed safely. The case remains under review and the payout stays blocked."};
 }
}


export async function approveReturnlessRefund(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireAdmin("/admin/commerce");
 const caseId=String(formData.get("caseId")??"");
 const notes=String(formData.get("notes")??"").trim();
 if(notes.length<10)return {status:"error",message:"Document why a refund without return is appropriate."};

 const supabase=await createSupabaseServerClient();
 const {error:gateError}=await supabase.rpc("admin_prepare_returnless_refund",{p_case_id:caseId,p_notes:notes});
 if(gateError)return {status:"error",message:"This case is not available for a refund without return."};

 try{
  const result=await refundTransactionCase(caseId);
  if(!result.refunded){
   revalidateCases();
   return {status:"error",message:result.reason==="stripe_not_configured"
    ?"Stripe refund processing is not configured yet."
    :result.reason==="payout_reconciliation_required"
     ?"Refund stopped safely: seller funds were already released, but the payout transfer reference is incomplete. Reconcile the Stripe transfer before retrying this refund."
     :"The refund could not be completed."};
  }
  revalidateCases();
  return {status:"success",message:"Refund completed without requiring the item to be returned."};
 }catch{
  revalidateCases();
  return {status:"error",message:"Refund processing failed safely. The case remains under review and payout stays blocked."};
 }
}
