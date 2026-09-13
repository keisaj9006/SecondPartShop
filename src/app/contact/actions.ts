"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const topics=new Set(["account","seller","listing","compatibility","safety","other"]);

export async function createSupportRequest(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/contact");
 const topic=String(formData.get("topic")??"");
 const message=String(formData.get("message")??"").trim();
 if(!topics.has(topic))return {status:"error",message:"Choose a support topic."};
 if(message.length<10)return {status:"error",message:"Please give us a little more detail."};
 if(message.length>2000)return {status:"error",message:"Support messages must be 2,000 characters or fewer."};
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.from("support_requests").insert({profile_id:user.id,topic,message});
 if(error)return {status:"error",message:"We could not submit your support request right now."};
 revalidatePath("/contact");
 return {status:"success",message:"Support request submitted. You can continue using SecondPart while it is reviewed."};
}

export async function replyToSupportRequest(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const requestId=String(formData.get("requestId")??"").trim();
 const message=String(formData.get("message")??"").trim();
 if(!requestId)return {status:"error",message:"This support conversation could not be identified."};
 await requireUser(`/contact/${requestId}`);
 if(message.length<1)return {status:"error",message:"Write a reply before sending."};
 if(message.length>2000)return {status:"error",message:"Support replies must be 2,000 characters or fewer."};
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("reply_to_support_request",{p_support_request_id:requestId,p_message:message});
 if(error){
  const closed=/closed/i.test(error.message??"");
  return {status:"error",message:closed?"This support conversation is closed and can no longer receive replies.":"We could not send your reply right now."};
 }
 revalidatePath(`/contact/${requestId}`);
 revalidatePath("/contact");
 return {status:"success",message:"Reply sent to SecondPart support."};
}