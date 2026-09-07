"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";

const value=(formData:FormData,name:string)=>String(formData.get(name)??"").trim();

export async function requestFittingQuote(formData:FormData){
 await requireUser("/account/fitting");
 const partId=value(formData,"partId");
 const garagePartnerId=value(formData,"garagePartnerId");
 const variantId=value(formData,"variantId");
 const year=Number(value(formData,"year"));
 const fuel=value(formData,"fuel");
 const engineText=value(formData,"engine");
 const registration=value(formData,"registration");
 const notes=value(formData,"notes").slice(0,1000);
 if(!isUuid(partId)||!isUuid(garagePartnerId)||!isUuid(variantId)||!Number.isInteger(year))redirect("/account/fitting?error=invalid");
 const engine=engineText?Number(engineText):undefined;
 if(engineText&&!Number.isInteger(engine))redirect("/account/fitting?error=invalid");
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("request_part_fitting_quote",{
  p_part_id:partId,
  p_garage_partner_id:garagePartnerId,
  p_vehicle_variant_id:variantId,
  p_vehicle_year:year,
  p_vehicle_fuel:fuel||undefined,
  p_vehicle_engine:engine,
  p_vehicle_registration:registration||undefined,
  p_notes:notes||undefined
 });
 if(error){
  const message=error.message.toLowerCase();
  if(message.includes("already open"))redirect("/account/fitting?error=duplicate");
  if(message.includes("too many"))redirect("/account/fitting?error=limit");
  redirect("/account/fitting?error=request");
 }
 redirect("/account/fitting?created=1");
}
