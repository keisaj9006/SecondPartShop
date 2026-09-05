"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function markNotificationRead(formData:FormData){
 const user=await requireUser("/notifications");
 const id=String(formData.get("id")??"");
 if(!id)return;
 const supabase=await createSupabaseServerClient();
 await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("profile_id",user.id);
 revalidatePath("/notifications");
 revalidatePath("/account");
}

export async function markAllNotificationsRead(){
 const user=await requireUser("/notifications");
 const supabase=await createSupabaseServerClient();
 await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("profile_id",user.id).is("read_at",null);
 revalidatePath("/notifications");
 revalidatePath("/account");
}
