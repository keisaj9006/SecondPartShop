"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";

export async function dismissMatchedPartRequest(formData:FormData){
 await requireSeller("/dashboard/requests");
 const requestId=String(formData.get("requestId")??"").trim();
 if(!isUuid(requestId))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("dismiss_seller_part_request_match",{p_request_id:requestId});
 if(error)throw new Error("This request could not be dismissed right now.");
 revalidatePath("/dashboard/requests");
}
