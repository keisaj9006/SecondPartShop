import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SellerPaymentAccount } from "@/lib/types";

export async function getSellerPaymentAccount(sellerId:string):Promise<SellerPaymentAccount|null>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("seller_payment_accounts")
  .select("seller_id,payment_provider,onboarding_status,transfers_enabled,payouts_enabled,details_submitted")
  .eq("seller_id",sellerId)
  .maybeSingle();
 if(error)throw new Error("Payment setup is temporarily unavailable.");
 if(!data)return null;
 return {
  sellerId:data.seller_id,
  provider:"stripe",
  onboardingStatus:data.onboarding_status as SellerPaymentAccount["onboardingStatus"],
  transfersEnabled:data.transfers_enabled,
  payoutsEnabled:data.payouts_enabled,
  detailsSubmitted:data.details_submitted
 };
}
