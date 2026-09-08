"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistSellerGeoAdmin,sellerGeoFromPostcode } from "@/lib/seller-geo";

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
