"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { releaseDuePayoutItem } from "@/lib/commerce-payouts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function confirmBuyerReceipt(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireUser("/account/orders");
 const orderItemId=String(formData.get("orderItemId")??"");
 const acceptNow=String(formData.get("acceptNow")??"")==="1";

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("buyer_mark_order_item_received",{
  p_order_item_id:orderItemId,
  p_accept_now:acceptNow
 });
 if(error)return {status:"error",message:"We could not update this purchase right now."};

 let payoutReleased=false;
 if(acceptNow){
  try{
   const result=await releaseDuePayoutItem(orderItemId);
   payoutReleased=result.released;
  }catch{
   payoutReleased=false;
  }
 }

 revalidatePath("/account/orders");
 revalidatePath("/dashboard/orders");
 revalidatePath("/account/reviews");
 return {
  status:"success",
  message:acceptNow
   ?payoutReleased?"Item accepted and transaction completed.":"Item accepted. Seller transfer is queued for automatic retry."
   :"Delivery confirmed. Buyer-protection review window is now running."
 };
}
