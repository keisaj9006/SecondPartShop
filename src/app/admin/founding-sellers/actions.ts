"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";

const statuses=new Set(["new","contacted","qualified","invited","onboarding","activated","rejected"]);

export async function updateFoundingSellerApplication(formData:FormData){
 await requireAdmin("/admin/founding-sellers");
 const id=String(formData.get("id")??"");
 const status=String(formData.get("status")??"");
 const adminNote=String(formData.get("adminNote")??"").trim().slice(0,2000);
 if(!isUuid(id)||!statuses.has(status))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.from("founding_seller_applications")
  .update({status,admin_note:adminNote||null})
  .eq("id",id);
 if(error)throw error;
 revalidatePath("/admin/founding-sellers");
}
