"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGaragePartnerForOwner } from "@/lib/data/fitting";
import { isPlausibleUkPostcode,lookupPostcodeLocation,normalizePostcode } from "@/lib/postcode";

const clean=(formData:FormData,name:string,max:number)=>String(formData.get(name)??"").trim().slice(0,max);
const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"garage";

export async function saveGaragePartner(formData:FormData){
 const user=await requireUser("/garage-partner");
 const businessName=clean(formData,"businessName",140);
 const location=clean(formData,"location",120);
 const postcode=normalizePostcode(clean(formData,"postcode",20));
 const description=clean(formData,"description",2000);
 if(businessName.length<2||location.length<2||!isPlausibleUkPostcode(postcode)||description.length<20){
  redirect("/garage-partner?error=invalid");
 }
 const supabase=await createSupabaseServerClient();
 const existing=await getGaragePartnerForOwner(user.id).catch(()=>null);
 const values={
  business_name:businessName,
  location,
  postcode,
  description,
  customer_supplied_parts:formData.get("customerSuppliedParts")==="on",
  recycled_parts:formData.get("recycledParts")==="on",
  mobile_fitting:formData.get("mobileFitting")==="on"
 };
 const result=existing
  ?await supabase.from("garage_partners").update(values).eq("id",existing.id).eq("owner_id",user.id).select("id").single()
  :await supabase.from("garage_partners").insert({...values,owner_id:user.id,slug:slugify(businessName)+"-"+user.id.slice(0,8)}).select("id").single();
 if(result.error||!result.data)redirect("/garage-partner?error=save");

 const geo=await lookupPostcodeLocation(postcode);
 const admin=createSupabaseAdminClient();
 const {error:geoError}=await admin.from("garage_partners").update({
  latitude:geo?.latitude??null,
  longitude:geo?.longitude??null,
  updated_at:new Date().toISOString()
 }).eq("id",result.data.id).eq("owner_id",user.id);
 if(geoError)redirect("/garage-partner?error=save");

 revalidatePath("/garage-partner");
 revalidatePath("/garages");
 revalidatePath("/admin/moderation");
 redirect("/garage-partner?saved=1");
}
