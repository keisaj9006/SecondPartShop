"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function updateSaleFulfilment(_previous:ActionState,formData:FormData):Promise<ActionState>{
 await requireSeller("/dashboard/orders");
 const orderItemId=String(formData.get("orderItemId")??"");
 const action=String(formData.get("fulfilmentAction")??"");
 const carrier=String(formData.get("carrier")??"").trim();
 const tracking=String(formData.get("tracking")??"").trim();

 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("seller_set_order_item_fulfilment",{
  p_order_item_id:orderItemId,
  p_action:action,
  p_carrier:carrier||undefined,
  p_tracking_number:tracking||undefined
 });
 if(error){
  const lower=error.message.toLowerCase();
  if(lower.includes("tracking"))return {status:"error",message:"Add a tracking or shipment reference."};
  if(lower.includes("not been paid"))return {status:"error",message:"This order is not ready for fulfilment."};
  return {status:"error",message:"We could not update this sale right now."};
 }
 revalidatePath("/dashboard/orders");
 revalidatePath("/account/orders");
 return {status:"success",message:action==="dispatch"?"Dispatch recorded.":action==="ready_for_collection"?"Buyer notified that collection is ready.":"Order updated."};
}
