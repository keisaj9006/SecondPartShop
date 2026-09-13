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

export async function adminReplyToSupportRequest(formData:FormData){
 const requestId=String(formData.get("requestId")??"").trim();
 const message=String(formData.get("message")??"").trim();
 const nextStatus=String(formData.get("nextStatus")??"").trim();
 await requireAdmin(requestId?`/admin/support/${requestId}`:"/admin/moderation");
 if(!requestId||message.length<1||message.length>2000)return;
 if(nextStatus&&!(["in_progress","resolved"] as string[]).includes(nextStatus))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("admin_reply_to_support_request",{
  p_support_request_id:requestId,
  p_message:message,
  p_next_status:nextStatus||null
 });
 if(error)throw error;
 revalidatePath(`/admin/support/${requestId}`);
 revalidatePath("/admin/moderation");
 revalidatePath(`/contact/${requestId}`);
 revalidatePath("/contact");
}

export async function updateSupportRequest(formData:FormData){
 const requestId=String(formData.get("requestId")??"").trim();
 const status=String(formData.get("status")??"").trim();
 await requireAdmin(requestId?`/admin/support/${requestId}`:"/admin/moderation");
 if(!requestId||!(["in_progress","resolved","closed"] as string[]).includes(status))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("admin_update_support_request_status",{p_support_request_id:requestId,p_status:status});
 if(error)throw error;
 revalidatePath("/admin/moderation");
 revalidatePath(`/admin/support/${requestId}`);
 revalidatePath(`/contact/${requestId}`);
 revalidatePath("/contact");
 revalidatePath("/admin/beta-feedback");
}

export async function adminAddSupportRequestNote(formData:FormData){
 const requestId=String(formData.get("requestId")??"").trim();
 const note=String(formData.get("note")??"").trim();
 await requireAdmin(requestId?`/admin/support/${requestId}`:"/admin/moderation");
 if(!requestId||note.length<1||note.length>2000)return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("admin_add_support_request_note",{p_support_request_id:requestId,p_note:note});
 if(error)throw error;
 revalidatePath(`/admin/support/${requestId}`);
}

export async function reviewGaragePartner(formData:FormData){
 await requireAdmin("/admin/moderation");
 const garageId=String(formData.get("garageId")??"");
 const decision=String(formData.get("decision")??"");
 if(!garageId||!["approve","reject"].includes(decision))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase
  .from("garage_partners")
  .update({
   status:decision==="approve"?"active":"rejected",
   verified_at:decision==="approve"?new Date().toISOString():null
  })
  .eq("id",garageId);
 if(error)throw error;
 revalidatePath("/admin/moderation");
 revalidatePath("/garages");
 revalidatePath("/garage-partner");
}