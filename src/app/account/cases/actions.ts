"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function openTransactionCase(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireUser("/account/cases");
 const orderItemId=String(formData.get("orderItemId")??"");
 const caseType=String(formData.get("caseType")??"return");
 const reason=String(formData.get("reason")??"").trim();
 const details=String(formData.get("details")??"").trim();

 if(!(["return","dispute"] as string[]).includes(caseType))return {status:"error",message:"Choose return or dispute."};
 if(reason.length<3)return {status:"error",message:"Choose a reason."};
 if(details.length<10)return {status:"error",message:"Please add at least a short explanation."};

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("open_transaction_case",{
  p_order_item_id:orderItemId,
  p_case_type:caseType,
  p_reason:reason,
  p_details:details
 });

 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("already open"))return {status:"error",message:"A case is already open for this item."};
  if(lower.includes("already closed"))return {status:"error",message:"This transaction is already closed."};
  return {status:"error",message:"We could not open the transaction case right now."};
 }

 revalidatePath("/account/cases");
 revalidatePath("/account/orders");
 revalidatePath("/dashboard/cases");
 revalidatePath("/dashboard/orders");
 return {status:"success",message:"Case opened. Any unreleased seller payout is now blocked while the case is reviewed."};
}
