"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";
import type { ActionState } from "@/lib/types";

export async function askSeller(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireUser("/account");
 const partId=String(formData.get("partId")??"");
 const body=String(formData.get("body")??"").trim();
 if(!isUuid(partId))return {status:"error",message:"This listing could not be identified."};
 if(body.length<2)return {status:"error",message:"Write your question first."};
 if(body.length>2000)return {status:"error",message:"Question must be 2,000 characters or fewer."};

 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("start_listing_conversation",{p_part_id:partId,p_body:body});
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("your own listing"))return {status:"error",message:"You cannot message yourself about your own listing."};
  if(lower.includes("rate limit")||lower.includes("conversation limit"))return {status:"error",message:"You have sent a lot of messages recently. Please try again later."};
  return {status:"error",message:"We could not send this question right now."};
 }
 redirect("/inbox/"+data);
}
