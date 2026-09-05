"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function requestSellerVerification(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const {user}=await requireSeller("/dashboard/verification");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return {status:"error",message:"Create your seller profile before requesting verification."};
 if(seller.verified)return {status:"success",message:"Your seller profile is already verified."};
 const message=String(formData.get("message")??"").trim().slice(0,500)||null;
 const supabase=await createSupabaseServerClient();
 const {data:pending,error:readError}=await supabase
  .from("seller_verification_requests")
  .select("id")
  .eq("seller_id",seller.id)
  .eq("status","pending")
  .maybeSingle();
 if(readError)return {status:"error",message:"We could not check your verification status right now."};
 if(pending)return {status:"success",message:"A verification request is already pending review."};
 const {error}=await supabase.from("seller_verification_requests").insert({seller_id:seller.id,requester_id:user.id,message});
 if(error)return {status:"error",message:"We could not submit the verification request right now."};
 revalidatePath("/dashboard/verification");
 revalidatePath("/dashboard");
 return {status:"success",message:"Verification request submitted for manual review."};
}
