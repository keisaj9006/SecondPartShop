"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlausibleUkRegistration,normalizeRegistration } from "@/lib/vehicle-registration";

const text=(value:FormDataEntryValue|null)=>String(value??"").trim();

export async function createDonorVehicle(formData:FormData){
 const {user}=await requireSeller("/dashboard/donors/new");
 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard");
 const make=text(formData.get("make")).slice(0,80);
 const model=text(formData.get("model")).slice(0,120);
 const variant=text(formData.get("variant")).slice(0,160)||null;
 const year=Number(text(formData.get("year")));
 const fuelType=text(formData.get("fuelType")).slice(0,80)||null;
 const engineValue=Number(text(formData.get("engineSizeSimple")));
 const engineSizeSimple=Number.isInteger(engineValue)&&engineValue>=100&&engineValue<=10000?engineValue:null;
 const colour=text(formData.get("colour")).slice(0,80)||null;
 const notes=text(formData.get("notes")).slice(0,1000)||null;
 const rawRegistration=text(formData.get("registration"));
 const registration=rawRegistration?normalizeRegistration(rawRegistration):null;
 if(make.length<2||!model||!Number.isInteger(year)||year<1900||year>2100)return;
 if(registration&&!isPlausibleUkRegistration(registration))return;
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.from("donor_vehicles").insert({
  seller_id:seller.id,
  registration,
  make,
  model,
  variant,
  year,
  fuel_type:fuelType,
  engine_size_simple:engineSizeSimple,
  colour,
  notes
 });
 if(error)throw error;
 revalidatePath("/dashboard");
 revalidatePath("/dashboard/donors");
 redirect("/dashboard/donors?created=1");
}

export async function deleteDonorVehicle(formData:FormData){
 const {user}=await requireSeller("/dashboard/donors");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return;
 const id=text(formData.get("id"));
 if(!id)return;
 const supabase=await createSupabaseServerClient();
 await supabase.from("donor_vehicles").delete().eq("id",id).eq("seller_id",seller.id);
 revalidatePath("/dashboard");
 revalidatePath("/dashboard/donors");
}
