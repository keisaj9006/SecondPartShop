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
 const legalBusinessName=String(formData.get("legalBusinessName")??"").trim().slice(0,180);
 const businessReference=String(formData.get("businessReference")??"").trim().slice(0,180)||null;
 const referenceUrl=String(formData.get("referenceUrl")??"").trim().slice(0,500)||null;
 const message=String(formData.get("message")??"").trim().slice(0,500)||null;
 if(legalBusinessName.length<2)return {status:"error",message:"Enter the legal or registered business name."};
 if(!businessReference&&!referenceUrl)return {status:"error",message:"Add a business/licensing reference or a public business URL."};
 if(referenceUrl&&!/^https:\/\//i.test(referenceUrl))return {status:"error",message:"Business reference URL must start with https://."};
 const supabase=await createSupabaseServerClient();
 const {data:pending,error:readError}=await supabase
  .from("seller_verification_requests")
  .select("id")
  .eq("seller_id",seller.id)
  .eq("status","pending")
  .maybeSingle();
 if(readError)return {status:"error",message:"We could not check your verification status right now."};
 if(pending)return {status:"success",message:"A verification request is already pending review."};
 const {error}=await supabase.from("seller_verification_requests").insert({seller_id:seller.id,requester_id:user.id,legal_business_name:legalBusinessName,business_reference:businessReference,reference_url:referenceUrl,message});
 if(error)return {status:"error",message:"We could not submit the verification request right now."};
 revalidatePath("/dashboard/verification");
 revalidatePath("/dashboard");
 return {status:"success",message:"Verification request submitted for manual review."};
}
