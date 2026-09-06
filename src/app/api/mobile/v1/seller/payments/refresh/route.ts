import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import {
 getStripeRecipientAccount,
 isStripeConnectConfigured,
 recipientTransferStatus
} from "@/lib/stripe-connect";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const seller=auth.seller;

 if(!isStripeConnectConfigured()){
  return mobileJson(request,{ok:false,error:"stripe_not_configured"},503);
 }

 const {data,error}=await supabase
  .from("seller_payment_accounts")
  .select("provider_account_id,onboarding_status")
  .eq("seller_id",seller.id)
  .maybeSingle();

 if(error)return mobileJson(request,{ok:false,error:"payment_account_unavailable"},503);
 if(!data?.provider_account_id)return mobileJson(request,{ok:true,complete:false,status:"not_started"});

 try{
  const account=await getStripeRecipientAccount(data.provider_account_id);
  const transferStatus=recipientTransferStatus(account);
  const complete=transferStatus==="active";
  const admin=createSupabaseAdminClient();
  const {error:updateError}=await admin.from("seller_payment_accounts").update({
   onboarding_status:complete?"complete":data.onboarding_status==="restricted"?"restricted":"pending",
   transfers_enabled:complete,
   details_submitted:complete
  }).eq("seller_id",seller.id);
  if(updateError)throw updateError;

  return mobileJson(request,{
   ok:true,
   complete,
   status:complete?"complete":"pending",
   transferStatus
  });
 }catch{
  return mobileJson(request,{ok:false,error:"stripe_status_refresh_failed"},503);
 }
}
