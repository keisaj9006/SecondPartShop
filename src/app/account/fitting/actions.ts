"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";

export async function respondToFittingQuote(formData:FormData){
 await requireUser("/account/fitting");
 const requestId=String(formData.get("requestId")??"");
 const action=String(formData.get("action")??"");
 if(!isUuid(requestId)||!["accept","cancel"].includes(action))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("buyer_respond_fitting_quote",{p_request_id:requestId,p_action:action});
 if(error)throw error;
 revalidatePath("/account/fitting");
 revalidatePath("/garage-partner/requests");
}
