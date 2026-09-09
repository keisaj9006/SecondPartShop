"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasCurrentMarketplaceTerms } from "@/lib/marketplace-policy";
import type { ActionState,FitFeedbackResult } from "@/lib/types";

const results=new Set<FitFeedbackResult>(["exact_fit","fit_with_modification","did_not_fit","not_installed"]);

export async function submitVerifiedFitFeedback(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/account/reviews");
 if(!await hasCurrentMarketplaceTerms(user.id))return {status:"error",message:"Accept the current Terms of Use and Privacy Policy in Account → Security before submitting fitment feedback."};
 const orderItemId=String(formData.get("orderItemId")??"").trim();
 const result=String(formData.get("result")??"").trim() as FitFeedbackResult;
 const notes=String(formData.get("notes")??"").trim();

 if(!orderItemId)return {status:"error",message:"Transaction could not be identified."};
 if(!results.has(result))return {status:"error",message:"Choose what happened when the part was fitted."};
 if(notes.length>1000)return {status:"error",message:"Fitment notes must be 1,000 characters or fewer."};

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("submit_verified_fit_feedback",{
  p_order_item_id:orderItemId,
  p_result:result,
  p_notes:notes||undefined
 });

 if(error){
  const message=error.message.toLowerCase();
  const known=message.includes("only the buyer")
   ?"Only the buyer from this transaction can verify fitment."
   :message.includes("completed, non-refunded")
    ?"Fitment feedback unlocks after the transaction is fully completed."
    :message.includes("vehicle snapshot")
     ?"This older transaction did not record a checkout vehicle, so it cannot create verified fitment evidence."
     :message.includes("transaction case")
      ?"Fitment feedback is paused while the transaction case is open."
      :"We could not save fitment feedback right now.";
  return {status:"error",message:known};
 }

 revalidatePath("/account/reviews");
 revalidatePath("/account/orders");
 return {status:"success",message:result==="not_installed"?"Saved. You can update this after the part is installed.":"Verified fitment feedback saved. Thanks for improving SecondPart compatibility data."};
}
