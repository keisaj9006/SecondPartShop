"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reportOperationalError } from "@/lib/ops-monitoring";
import { syncSellerPaymentAccount } from "@/lib/seller-payment-sync";
import {
 createStripeOnboardingLink,
 createStripeRecipientAccount,
 isStripeConnectConfigured
} from "@/lib/stripe-connect";

export async function startStripeOnboarding(){
 const {user}=await requireSeller("/dashboard/payments");
 if(!isStripeConnectConfigured())redirect("/dashboard/payments?error=not-configured");

 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard?error=seller-profile-required");
 if(!user.email)redirect("/dashboard/payments?error=email-required");

 const supabase=await createSupabaseServerClient();
 const {data:existing}=await supabase
  .from("seller_payment_accounts")
  .select("provider_account_id")
  .eq("seller_id",seller.id)
  .maybeSingle();

 let onboardingUrl:string;
 try{
  let accountId=existing?.provider_account_id??null;
  if(!accountId){
   const account=await createStripeRecipientAccount({
    email:user.email,
    displayName:seller.businessName,
    idempotencyKey:`secondpart-recipient-${seller.id}`
   });
   accountId=account.id;
   const admin=createSupabaseAdminClient();
   const {error}=await admin.from("seller_payment_accounts").upsert({
    seller_id:seller.id,
    payment_provider:"stripe",
    provider_account_id:account.id,
    onboarding_status:"pending",
    transfers_enabled:false,
    payouts_enabled:false,
    details_submitted:false
   },{onConflict:"seller_id"});
   if(error)throw error;
  }
  onboardingUrl=await createStripeOnboardingLink(accountId);
 }catch(error){
  await reportOperationalError({component:"payout",event:"seller_stripe_onboarding_start_failed",error});
  redirect("/dashboard/payments?error=stripe");
 }
 redirect(onboardingUrl);
}

export async function refreshStripePaymentStatus(){
 const {user}=await requireSeller("/dashboard/payments");
 if(!isStripeConnectConfigured())redirect("/dashboard/payments?error=not-configured");

 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard");

 let synced=false;
 try{
  await syncSellerPaymentAccount(seller.id);
  synced=true;
  revalidatePath("/dashboard/payments");
 }catch(error){
  await reportOperationalError({component:"payout",event:"seller_stripe_status_sync_failed",error});
  synced=false;
 }

 redirect(synced?"/dashboard/payments?refreshed=1":"/dashboard/payments?error=sync");
}
