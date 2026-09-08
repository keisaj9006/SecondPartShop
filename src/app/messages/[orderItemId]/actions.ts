"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { schedulePushDispatch } from "@/lib/push/schedule";

export async function sendTransactionMessage(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireUser("/account");
 const orderItemId=String(formData.get("orderItemId")??"");
 const body=String(formData.get("body")??"").trim();
 if(!body)return {status:"error",message:"Write a message first."};
 if(body.length>2000)return {status:"error",message:"Message must be 2,000 characters or fewer."};

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("send_transaction_message",{
  p_order_item_id:orderItemId,
  p_body:body
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("after payment"))return {status:"error",message:"Transaction messaging becomes available after payment."};
  return {status:"error",message:"We could not send this message right now."};
 }

 schedulePushDispatch(50);
 revalidatePath("/messages/"+orderItemId);
 return {status:"success",message:"Message sent."};
}
