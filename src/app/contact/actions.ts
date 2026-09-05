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
