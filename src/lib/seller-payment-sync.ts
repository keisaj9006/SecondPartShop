import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeRecipientAccount,isStripeConnectConfigured,recipientTransferStatus } from "@/lib/stripe-connect";

type PaymentAccountRow={
 seller_id:string;
 provider_account_id:string|null;
 onboarding_status:string;
 transfers_enabled:boolean;
 details_submitted:boolean;
};

const restrictedStatuses=new Set(["restricted","inactive","disabled","rejected"]);

async function syncAccountRow(admin:ReturnType<typeof createSupabaseAdminClient>,row:PaymentAccountRow){
 if(!row.provider_account_id)return {active:false,status:"missing"} as const;
 const account=await getStripeRecipientAccount(row.provider_account_id);
 const transferStatus=recipientTransferStatus(account).toLowerCase();
 const active=transferStatus==="active";
 const restricted=restrictedStatuses.has(transferStatus);
 const onboardingStatus=active?"complete":restricted?"restricted":"pending";

 const {error:updateError}=await admin
  .from("seller_payment_accounts")
  .update({
   onboarding_status:onboardingStatus,
   transfers_enabled:active,
   details_submitted:active?true:row.details_submitted
  })
  .eq("seller_id",row.seller_id);
 if(updateError)throw updateError;

 return {active,status:transferStatus} as const;
}

export async function syncSellerPaymentAccount(sellerId:string){
 if(!isStripeConnectConfigured())return {active:false,status:"not_configured"} as const;
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("seller_payment_accounts")
  .select("seller_id,provider_account_id,onboarding_status,transfers_enabled,details_submitted")
  .eq("seller_id",sellerId)
  .maybeSingle();
 if(error)throw error;
 if(!data?.provider_account_id)return {active:false,status:"not_connected"} as const;
 return syncAccountRow(admin,data as PaymentAccountRow);
}

export async function syncPendingSellerPaymentAccounts(limit=100){
 if(!isStripeConnectConfigured())return {checked:0,activated:0,pending:0,failed:0,skipped:true};

 const admin=createSupabaseAdminClient();
 const {data,error}=await admin
  .from("seller_payment_accounts")
  .select("seller_id,provider_account_id,onboarding_status,transfers_enabled,details_submitted")
  .eq("payment_provider","stripe")
  .not("provider_account_id","is",null)
  .limit(Math.max(1,Math.min(limit,500)));
 if(error)throw error;

 let activated=0;
 let pending=0;
 let failed=0;

 for(const row of data??[]){
  try{
   const result=await syncAccountRow(admin,row as PaymentAccountRow);
   if(result.active)activated+=1;else pending+=1;
  }catch{
   failed+=1;
  }
 }

 return {checked:data?.length??0,activated,pending,failed,skipped:false};
}
