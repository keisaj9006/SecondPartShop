"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlausibleUkRegistration,normalizeRegistration } from "@/lib/vehicle-registration";

const text=(value:FormDataEntryValue|null)=>String(value??"").trim();

export async function createPartRequest(formData:FormData){
 const user=await requireUser("/requests");
 const queryText=text(formData.get("queryText")).slice(0,160);
 const oemNumber=text(formData.get("oemNumber")).slice(0,80)||null;
 const notes=text(formData.get("notes")).slice(0,1000)||null;
 const categoryId=text(formData.get("categoryId"))||null;
 const catalogueVariantId=text(formData.get("variantId"))||null;
 const yearValue=Number(text(formData.get("year")));
 const year=Number.isInteger(yearValue)&&yearValue>=1900&&yearValue<=2100?yearValue:null;
 const fuelType=text(formData.get("fuel"))||null;
 const engineValue=Number(text(formData.get("engine")));
 const engineSizeSimple=Number.isInteger(engineValue)&&engineValue>=100&&engineValue<=10000?engineValue:null;
 const rawRegistration=text(formData.get("registration"));
 const registration=rawRegistration?normalizeRegistration(rawRegistration):null;
 if(queryText.length<3)return;
 if(registration&&!isPlausibleUkRegistration(registration))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.from("part_requests").insert({
  profile_id:user.id,
  category_id:categoryId,
  catalogue_variant_id:catalogueVariantId,
  registration,
  year,
  fuel_type:fuelType,
  engine_size_simple:engineSizeSimple,
  query_text:queryText,
  oem_number:oemNumber,
  notes
 });
 if(error)throw error;
 revalidatePath("/requests");
 redirect("/requests?created=1");
}

export async function closePartRequest(formData:FormData){
 const user=await requireUser("/requests");
 const id=text(formData.get("id"));
 if(!id)return;
 const supabase=await createSupabaseServerClient();
 await supabase.from("part_requests").update({status:"closed",updated_at:new Date().toISOString()}).eq("id",id).eq("profile_id",user.id);
 revalidatePath("/requests");
}

export async function deletePartRequest(formData:FormData){
 const user=await requireUser("/requests");
 const id=text(formData.get("id"));
 if(!id)return;
 const supabase=await createSupabaseServerClient();
 await supabase.from("part_requests").delete().eq("id",id).eq("profile_id",user.id);
 revalidatePath("/requests");
}
