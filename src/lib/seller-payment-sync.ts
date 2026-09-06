import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeRecipientAccount,isStripeConnectConfigured,recipientTransferStatus } from "@/lib/stripe-connect";

export async function syncPendingSellerPaymentAccounts(limit=100){
 if(!isStripeConnectConfigured())return {checked:0,activated:0,pending:0,failed:0,skipped:true};

 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("seller_payment_accounts")
  .select("seller_id,provider_account_id,onboarding_status,transfers_enabled")
  .eq("payment_provider","stripe")
  .neq("onboarding_status","complete")
  .not("provider_account_id","is",null)
  .limit(Math.max(1,Math.min(limit,500)));
 if(error)throw error;

 let activated=0;
 let pending=0;
 let failed=0;

 for(const row of data??[]){
  if(!row.provider_account_id){pending+=1;continue;}
  try{
   const account=await getStripeRecipientAccount(row.provider_account_id);
   const transferStatus=recipientTransferStatus(account);
   const complete=transferStatus==="active";
   const {error:updateError}=await admin
    .from("seller_payment_accounts")
    .update({
     onboarding_status:complete?"complete":row.onboarding_status==="restricted"?"restricted":"pending",
     transfers_enabled:complete,
     details_submitted:complete
    })
    .eq("seller_id",row.seller_id);
   if(updateError)throw updateError;
   if(complete)activated+=1;else pending+=1;
  }catch{
   failed+=1;
  }
 }

 return {checked:data?.length??0,activated,pending,failed,skipped:false};
}
