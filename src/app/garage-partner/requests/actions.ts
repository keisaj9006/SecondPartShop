"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGaragePartnerForOwner } from "@/lib/data/fitting";
import { isUuid } from "@/lib/identifiers";
import { schedulePushDispatch } from "@/lib/push/schedule";

export async function respondToFittingRequest(formData:FormData){
 const user=await requireUser("/garage-partner/requests");
 const partner=await getGaragePartnerForOwner(user.id);
 if(!partner||partner.status!=="active")return;
 const requestId=String(formData.get("requestId")??"");
 const action=String(formData.get("action")??"");
 const note=String(formData.get("note")??"").trim().slice(0,1000);
 if(!isUuid(requestId)||!["quote","decline","complete"].includes(action))return;
 let quotePence:number|undefined;
 if(action==="quote"){
  const pounds=Number(formData.get("quote")??"");
  if(!Number.isFinite(pounds)||pounds<0||pounds>20000)return;
  quotePence=Math.round(pounds*100);
 }
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("garage_respond_fitting_request",{
  p_request_id:requestId,p_action:action,p_quote_pence:quotePence,p_note:note||undefined
 });
 if(error)throw error;
 schedulePushDispatch(50);
 revalidatePath("/garage-partner/requests");
 revalidatePath("/account/fitting");
}
