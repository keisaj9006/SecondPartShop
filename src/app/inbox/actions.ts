"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";
import type { ActionState } from "@/lib/types";
import { schedulePushDispatch } from "@/lib/push/schedule";

export async function sendListingMessage(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireUser("/inbox");
 const conversationId=String(formData.get("conversationId")??"");
 const body=String(formData.get("body")??"").trim();
 if(!isUuid(conversationId))return {status:"error",message:"Conversation could not be identified."};
 if(!body)return {status:"error",message:"Write a message first."};
 if(body.length>2000)return {status:"error",message:"Message must be 2,000 characters or fewer."};

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("send_listing_conversation_message",{
  p_conversation_id:conversationId,
  p_body:body
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("rate limit"))return {status:"error",message:"Message limit reached. Please try again later."};
  if(lower.includes("accept current terms"))return {status:"error",message:"Accept the current Terms of Use and Privacy Policy in Account → Security before messaging."};
  if(lower.includes("messaging is unavailable"))return {status:"error",message:"Pre-purchase messaging with this account is blocked."};
  return {status:"error",message:"We could not send this message right now."};
 }
 schedulePushDispatch(50);
 revalidatePath("/inbox");
 revalidatePath("/inbox/"+conversationId);
 return {status:"success",message:"Message sent."};
}

export async function closeListingConversation(formData:FormData){
 await requireUser("/inbox");
 const conversationId=String(formData.get("conversationId")??"");
 if(!isUuid(conversationId))return;
 const supabase=await createSupabaseServerClient();
 await supabase.rpc("close_listing_conversation",{p_conversation_id:conversationId});
 revalidatePath("/inbox");
 revalidatePath("/inbox/"+conversationId);
}
