"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistSellerGeoAdmin,sellerGeoFromPostcode } from "@/lib/seller-geo";
import { schedulePushDispatch } from "@/lib/push/schedule";

export async function refreshMissingSellerGeo(){
 await requireAdmin("/admin/system");
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("sellers")
  .select("id,postcode")
  .not("postcode","is",null)
  .or("latitude.is.null,longitude.is.null")
  .order("created_at",{ascending:true})
  .limit(100);

 if(error)redirect("/admin/system?geo-error=load");

 let updated=0;
 let unresolved=0;
 for(const row of data??[]){
  const geo=await sellerGeoFromPostcode(row.postcode);
  if(geo.latitude===null||geo.longitude===null){
   unresolved+=1;
   continue;
  }
  try{
   await persistSellerGeoAdmin(row.id,geo);
   updated+=1;
  }catch{
   redirect("/admin/system?geo-error=save");
  }
 }

 revalidatePath("/admin/system");
 revalidatePath("/");
 redirect(`/admin/system?geo-updated=${updated}&geo-unresolved=${unresolved}`);
}


export async function retryExhaustedPushes(){
 await requireAdmin("/admin/system");
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("mobile_push_outbox")
  .select("id")
  .eq("status","failed")
  .gte("attempts",5)
  .order("updated_at",{ascending:true})
  .limit(100);

 if(error)redirect("/admin/system?push-error=load");
 const ids=(data??[]).map(row=>row.id);
 if(!ids.length)redirect("/admin/system?push-retried=0");

 const now=new Date().toISOString();
 const {error:updateError}=await admin
  .from("mobile_push_outbox")
  .update({attempts:0,status:"failed",next_attempt_at:now,updated_at:now})
  .in("id",ids);
 if(updateError)redirect("/admin/system?push-error=retry");

 schedulePushDispatch(100);
 revalidatePath("/admin/system");
 redirect("/admin/system?push-retried="+ids.length);
}
