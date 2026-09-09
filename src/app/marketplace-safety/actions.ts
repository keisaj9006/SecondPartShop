"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireUser} from "@/lib/auth";
import {isUuid} from "@/lib/identifiers";
import {safeInternalPath} from "@/lib/navigation";
import {createSupabaseServerClient} from "@/lib/supabase/server";

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
