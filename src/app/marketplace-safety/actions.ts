"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireUser} from "@/lib/auth";
import {isUuid} from "@/lib/identifiers";
import {safeInternalPath} from "@/lib/navigation";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import type {ActionState} from "@/lib/types";

export async function updateMarketplaceUserBlock(formData:FormData){
 await requireUser("/");
 const targetProfileId=String(formData.get("targetProfileId")??"");
 const operation=String(formData.get("operation")??"");
 const returnTo=safeInternalPath(formData.get("returnTo"),"/");
 if(!isUuid(targetProfileId)||!["block","unblock"].includes(operation))redirect(returnTo);

 const supabase=await createSupabaseServerClient();
 const fn=operation==="block"?"block_marketplace_user":"unblock_marketplace_user";
 const {error}=await supabase.rpc(fn,{p_blocked_profile_id:targetProfileId});
 if(error)redirect(returnTo+(returnTo.includes("?")?"&":"?")+"blockError=1");

 revalidatePath("/inbox");
 revalidatePath(returnTo.split("?")[0]||"/");
 redirect(returnTo+(returnTo.includes("?")?"&":"?")+(operation==="block"?"blocked=1":"unblocked=1"));
}

const userReportReasons=new Set(["harassment","spam","fraud_scam","seller_conduct","other"]);

export async function submitMarketplaceUserReport(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/");
 const targetProfileId=String(formData.get("targetProfileId")??"");
 const reason=String(formData.get("reason")??"");
 const details=String(formData.get("details")??"").trim().slice(0,1000)||null;
 if(!isUuid(targetProfileId)||targetProfileId===user.id)return {status:"error",message:"Choose a valid account to report."};
 if(!userReportReasons.has(reason))return {status:"error",message:"Choose a valid report reason."};
 const supabase=await createSupabaseServerClient();
 const {data:target,error:targetError}=await supabase.from("profiles").select("id").eq("id",targetProfileId).maybeSingle();
 if(targetError||!target)return {status:"error",message:"This account is no longer available to report."};
 const {error}=await supabase.from("marketplace_reports").insert({
  reporter_id:user.id,
  reported_profile_id:targetProfileId,
  reason,
  details
 });
 if(error)return {status:"error",message:"We could not submit this report right now."};
 return {status:"success",message:"Report submitted. Our moderation queue will review it."};
}
