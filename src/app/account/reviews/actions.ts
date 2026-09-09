"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasCurrentMarketplaceTerms } from "@/lib/marketplace-policy";
import type { ActionState } from "@/lib/types";

const rating=(formData:FormData,name:string,required=false)=>{
 const raw=String(formData.get(name)??"").trim();
 if(!raw)return required?NaN:null;
 const value=Number(raw);
 return Number.isInteger(value)&&value>=1&&value<=5?value:NaN;
};

export async function submitReview(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/account/reviews");
 if(!await hasCurrentMarketplaceTerms(user.id))return {status:"error",message:"Accept the current Terms of Use and Privacy Policy in Account → Security before submitting a review."};
 const orderItemId=String(formData.get("orderItemId")??"").trim();
 const overall=rating(formData,"overall",true);
 const itemAsDescribed=rating(formData,"itemAsDescribed");
 const dispatch=rating(formData,"dispatch");
 const communication=rating(formData,"communication");
 const buyerConduct=rating(formData,"buyerConduct");
 const comment=String(formData.get("comment")??"").trim();

 if(!orderItemId)return {status:"error",message:"Transaction could not be identified."};
 if(Number.isNaN(overall)||[itemAsDescribed,dispatch,communication,buyerConduct].some(value=>typeof value==="number"&&Number.isNaN(value)))return {status:"error",message:"Ratings must be between 1 and 5 stars."};
 if(comment.length>2000)return {status:"error",message:"Review must be 2,000 characters or fewer."};

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("submit_transaction_review",{
  p_order_item_id:orderItemId,
  p_overall_rating:overall as number,
  p_item_as_described_rating:itemAsDescribed??undefined,
  p_dispatch_rating:dispatch??undefined,
  p_communication_rating:communication??undefined,
  p_buyer_conduct_rating:buyerConduct??undefined,
  p_comment:comment||undefined
 });

 if(error){
  const known=error.message.includes("already reviewed")?"You have already reviewed this transaction.":error.message.includes("funds are released")?"This transaction is not ready for review yet.":"We could not submit your review right now.";
  return {status:"error",message:known};
 }

 revalidatePath("/account/reviews");
 revalidatePath("/account");
 return {status:"success",message:"Review submitted. It will publish when the other side reviews or after the double-blind window ends."};
}
