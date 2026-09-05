"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCatalogueSelection } from "@/lib/data/vehicle-catalogue";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlausibleUkRegistration,normalizeRegistration } from "@/lib/vehicle-registration";

const text=(value:FormDataEntryValue|null)=>String(value??"").trim();

export async function saveGarageVehicle(formData:FormData){
 const user=await requireUser("/");
 const variantId=text(formData.get("variantId"));
 const year=Number(text(formData.get("year")));
 const fuel=text(formData.get("fuel"))||undefined;
 const engineText=text(formData.get("engine"));
 const engine=engineText?Number(engineText):undefined;
 const rawRegistration=text(formData.get("registration"));
 const registration=rawRegistration?normalizeRegistration(rawRegistration):null;
 const nickname=text(formData.get("nickname")).slice(0,50)||null;
 if(!variantId||!Number.isInteger(year))return;
 if(registration&&!isPlausibleUkRegistration(registration))return;
 const selection=await getCatalogueSelection(variantId,year,fuel,Number.isInteger(engine)?engine:undefined);
 if(!selection)return;
 const supabase=await createSupabaseServerClient();
 const {data:existing}=await supabase
  .from("garage_vehicles")
  .select("id,registration,fuel_type,engine_size_simple")
  .eq("profile_id",user.id)
  .eq("catalogue_variant_id",variantId)
  .eq("year",year);
 const duplicate=(existing??[]).some(row=>
  (row.registration??null)===(registration??null)&&
  (row.fuel_type??null)===(selection.fuelType??null)&&
  (row.engine_size_simple??null)===(selection.engineSizeSimple??null)
 );
 if(!duplicate){
  await supabase.from("garage_vehicles").insert({
   profile_id:user.id,
   catalogue_variant_id:variantId,
   registration,
   year,
   fuel_type:selection.fuelType,
   engine_size_simple:selection.engineSizeSimple,
   nickname
  });
 }
 revalidatePath("/");
 revalidatePath("/garage");
 revalidatePath("/account");
}

export async function removeGarageVehicle(formData:FormData){
 const user=await requireUser("/garage");
 const id=text(formData.get("id"));
 if(!id)return;
 const supabase=await createSupabaseServerClient();
 await supabase.from("garage_vehicles").delete().eq("id",id).eq("profile_id",user.id);
 revalidatePath("/");
 revalidatePath("/garage");
 revalidatePath("/account");
}
