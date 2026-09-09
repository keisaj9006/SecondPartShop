import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {CURRENT_MARKETPLACE_TERMS_VERSION} from "@/lib/policy-versions";

export async function hasCurrentMarketplaceTerms(profileId:string){
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("profiles")
  .select("terms_accepted_at,terms_version,privacy_acknowledged_at")
  .eq("id",profileId)
  .maybeSingle();
 if(error||!data)return false;
 return Boolean(
  data.terms_accepted_at&&
  data.privacy_acknowledged_at&&
  data.terms_version===CURRENT_MARKETPLACE_TERMS_VERSION
 );
}

export async function requireCurrentMarketplaceTerms(profileId:string){
 if(!await hasCurrentMarketplaceTerms(profileId))throw new Error("marketplace_terms_required");
}
