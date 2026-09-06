"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
 createStripeOnboardingLink,
 createStripeRecipientAccount,
 getStripeRecipientAccount,
 isStripeConnectConfigured,
 recipientTransferStatus
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
   const account=await createStripeRecipientAccount({email:user.email,displayName:seller.businessName});
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
 }catch{
  redirect("/dashboard/payments?error=stripe");
 }
 redirect(onboardingUrl);
}

export async function refreshStripePaymentStatus(){
 const {user}=await requireSeller("/dashboard/payments");
 if(!isStripeConnectConfigured())redirect("/dashboard/payments?error=not-configured");

 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard");

 const supabase=await createSupabaseServerClient();
 const {data}=await supabase
  .from("seller_payment_accounts")
  .select("provider_account_id")
  .eq("seller_id",seller.id)
  .maybeSingle();

 if(!data?.provider_account_id)redirect("/dashboard/payments");

 let synced=false;
 try{
  const account=await getStripeRecipientAccount(data.provider_account_id);
  const transferStatus=recipientTransferStatus(account);
  const complete=transferStatus==="active";
  const admin=createSupabaseAdminClient();
  const {error}=await admin.from("seller_payment_accounts").update({
   onboarding_status:complete?"complete":"pending",
   transfers_enabled:complete,
   details_submitted:complete
  }).eq("seller_id",seller.id);
  if(error)throw error;
  synced=true;
  revalidatePath("/dashboard/payments");
 }catch{
  synced=false;
 }

 redirect(synced?"/dashboard/payments?refreshed=1":"/dashboard/payments?error=sync");
}
