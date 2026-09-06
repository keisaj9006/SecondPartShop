import "server-only";

import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

export type PartPassportEvidence={
 donor:{
  make:string;
  model:string;
  variant:string|null;
  year:number;
  fuelType:string|null;
  engineSizeSimple:number|null;
  colour:string|null;
 }|null;
 explicitFitmentCount:number;
 verifiedFitReportCount:number;
};

export async function getPartPassportEvidence(partId:string):Promise<PartPassportEvidence|null>{
 const supabase=createSupabasePublicServerClient();
 const {data,error}=await supabase.rpc("get_part_passport_evidence",{p_part_id:partId});
 if(error)throw new Error("Part Passport evidence is temporarily unavailable.");
 const row=data?.[0];
 if(!row)return null;
 const donor=row.donor_make&&row.donor_model&&row.donor_year?{
  make:row.donor_make,
  model:row.donor_model,
  variant:row.donor_variant,
  year:Number(row.donor_year),
  fuelType:row.donor_fuel_type,
  engineSizeSimple:row.donor_engine_size_simple===null?null:Number(row.donor_engine_size_simple),
  colour:row.donor_colour
 }:null;
 return {
  donor,
  explicitFitmentCount:Number(row.explicit_fitment_count??0),
  verifiedFitReportCount:Number(row.verified_fit_report_count??0)
 };
}
