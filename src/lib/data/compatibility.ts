import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CompatibilityInfo,CompatibilityLevel,MarketplaceFilters } from "@/lib/types";

const copy:Record<CompatibilityLevel,CompatibilityInfo>={
 confirmed:{
  level:"confirmed",
  label:"Confirmed for your vehicle",
  detail:"This listing has an explicit fitment for the selected vehicle configuration."
 },
 family_match:{
  level:"family_match",
  label:"Vehicle family match — verify details",
  detail:"This part is recorded for the same vehicle family, but the exact derivative is not confirmed. Check OE/OEM number and seller details before ordering."
 },
 unverified:{
  level:"unverified",
  label:"Compatibility not verified",
  detail:"SecondPart does not have enough fitment evidence to confirm this part for the selected vehicle."
 }
};

export function compatibilityInfo(level:CompatibilityLevel):CompatibilityInfo{
 return copy[level];
}

export async function getCompatibilityMap(filters:MarketplaceFilters,partId?:string){
 const supabase=await createSupabaseServerClient();
 const map=new Map<string,CompatibilityInfo>();
 if(filters.catalogueVariant&&filters.catalogueYear!==undefined){
  const {data,error}=await supabase.rpc("marketplace_catalogue_compatibility",{
   p_variant_id:filters.catalogueVariant,
   p_year:filters.catalogueYear,
   p_fuel:filters.catalogueFuel,
   p_engine:filters.catalogueEngineSize,
   p_part_id:partId
  });
  if(error)throw error;
  for(const row of data??[]){
   if(row.confidence==="confirmed"||row.confidence==="family_match")map.set(row.part_id,compatibilityInfo(row.confidence));
  }
  return map;
 }
 if(filters.vehicle){
  const {data,error}=await supabase.rpc("marketplace_legacy_vehicle_compatibility",{
   p_vehicle_id:filters.vehicle,
   p_part_id:partId
  });
  if(error)throw error;
  for(const row of data??[]){
   if(row.confidence==="confirmed"||row.confidence==="family_match")map.set(row.part_id,compatibilityInfo(row.confidence));
  }
 }
 return map;
}

export async function getPartCompatibility(partId:string,filters:MarketplaceFilters):Promise<CompatibilityInfo|null>{
 if(!filters.vehicle&&!filters.catalogueVariant)return null;
 const map=await getCompatibilityMap(filters,partId);
 return map.get(partId)??compatibilityInfo("unverified");
}
