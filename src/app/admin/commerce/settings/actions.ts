"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";

export async function updateCommerceSettings(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireAdmin("/admin/commerce/settings");

 const feePercent=Number(formData.get("platformFeePercent"));
 const reservationMinutes=Math.round(Number(formData.get("checkoutReservationMinutes")));
 const autoReleaseHours=Math.round(Number(formData.get("autoReleaseHours")));

 if(!Number.isFinite(feePercent)||feePercent<0||feePercent>25)return {status:"error",message:"Seller platform fee must be between 0% and 25%."};
 if(!Number.isInteger(reservationMinutes)||reservationMinutes<30||reservationMinutes>240)return {status:"error",message:"Checkout reservation must be between 30 and 240 minutes."};
 if(!Number.isInteger(autoReleaseHours)||autoReleaseHours<12||autoReleaseHours>168)return {status:"error",message:"Auto-release window must be between 12 and 168 hours."};

 const feeBps=Math.round(feePercent*100);
 const admin=createSupabaseAdminClient();
 const {error}=await admin
  .from("commerce_settings")
  .update({
   platform_fee_bps:feeBps,
   checkout_reservation_minutes:reservationMinutes,
   auto_release_hours:autoReleaseHours
  })
  .eq("singleton",true);

 if(error)return {status:"error",message:"Commerce settings could not be saved."};

 revalidatePath("/admin/commerce/settings");
 revalidatePath("/admin/commerce");
 return {status:"success",message:"Commerce settings saved. New checkouts will use these values."};
}
