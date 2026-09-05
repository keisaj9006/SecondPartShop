"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const reasons=new Set(["suspected_counterfeit","incorrect_fitment","misleading_description","unsafe_item","seller_conduct","other"]);
const safeReturnTo=(value:FormDataEntryValue|null)=>{const target=typeof value==="string"?value:"/";return target.startsWith("/")&&!target.startsWith("//")?target:"/";};

export async function submitMarketplaceReport(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const user=await requireUser("/report");
 const partId=String(formData.get("partId")??"");
 const reason=String(formData.get("reason")??"");
 const details=String(formData.get("details")??"").trim().slice(0,1000)||null;
 if(!partId||!reasons.has(reason))return {status:"error",message:"Choose a valid reason for the report."};
 const supabase=await createSupabaseServerClient();
 const {data:part,error:partError}=await supabase.from("parts").select("id,seller_id").eq("id",partId).maybeSingle();
 if(partError||!part)return {status:"error",message:"This listing is no longer available to report."};
 const {error}=await supabase.from("marketplace_reports").insert({reporter_id:user.id,part_id:part.id,seller_id:part.seller_id,reason,details});
 if(error)return {status:"error",message:"We could not submit the report right now."};
 const target=safeReturnTo(formData.get("returnTo"));
 redirect(target+(target.includes("?")?"&":"?")+"reported=1");
}
