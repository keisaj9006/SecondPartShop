import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import {
 createStripeOnboardingLink,
 createStripeRecipientAccount,
 getAppUrl,
 isStripeConnectConfigured
} from "@/lib/stripe-connect";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {user,supabase}=auth.context;
 const seller=auth.seller;

 if(!isStripeConnectConfigured()){
  return mobileJson(request,{ok:false,error:"stripe_not_configured"},503);
 }
 if(!user.email)return mobileJson(request,{ok:false,error:"email_required"},400);

 const {data:existing,error:existingError}=await supabase
  .from("seller_payment_accounts")
  .select("provider_account_id")
  .eq("seller_id",seller.id)
  .maybeSingle();

 if(existingError)return mobileJson(request,{ok:false,error:"payment_account_unavailable"},503);

 try{
  let accountId=existing?.provider_account_id??null;
  if(!accountId){
   const account=await createStripeRecipientAccount({
    email:user.email,
    displayName:seller.business_name
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

  const appUrl=getAppUrl();
  const url=await createStripeOnboardingLink(accountId,{
   refreshUrl:`${appUrl}/seller/payments/mobile-complete?state=refresh`,
   returnUrl:`${appUrl}/seller/payments/mobile-complete?state=returned`
  });
  return mobileJson(request,{ok:true,url});
 }catch{
  return mobileJson(request,{ok:false,error:"stripe_onboarding_failed"},503);
 }
}
