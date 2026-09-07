"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";

export async function sendFittingMessage(formData:FormData){
 await requireUser("/account/fitting");
 const requestId=String(formData.get("requestId")??"");
 const body=String(formData.get("body")??"").trim().slice(0,2000);
 if(!isUuid(requestId)||!body)return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("send_fitting_request_message",{p_request_id:requestId,p_body:body});
 if(error)throw error;
 revalidatePath("/fitting/"+requestId);
 revalidatePath("/account/fitting");
 revalidatePath("/garage-partner/requests");
}
