"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function reviewSellerVerification(formData:FormData){
 await requireAdmin("/admin/moderation");
 const requestId=String(formData.get("requestId")??"");
 const decision=String(formData.get("decision")??"");
 const note=String(formData.get("note")??"").trim().slice(0,500)||undefined;
 if(!requestId||!["approve","reject"].includes(decision))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("admin_review_seller_verification",{p_request_id:requestId,p_approve:decision==="approve",p_review_note:note});
 if(error)throw error;
 revalidatePath("/admin/moderation");
 revalidatePath("/sellers");
 revalidatePath("/dashboard/verification");
}

export async function updateMarketplaceReport(formData:FormData){
 await requireAdmin("/admin/moderation");
 const reportId=String(formData.get("reportId")??"");
 const status=String(formData.get("status")??"");
 if(!reportId||!["reviewed","dismissed","actioned"].includes(status))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("admin_update_marketplace_report",{p_report_id:reportId,p_status:status});
 if(error)throw error;
 revalidatePath("/admin/moderation");
}


export async function updateSupportRequest(formData:FormData){
 await requireAdmin("/admin/moderation");
 const requestId=String(formData.get("requestId")??"");
 const status=String(formData.get("status")??"");
 if(!requestId||!["in_progress","closed"].includes(status))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.from("support_requests").update({status,updated_at:new Date().toISOString()}).eq("id",requestId);
 if(error)throw error;
 revalidatePath("/admin/moderation");
}
