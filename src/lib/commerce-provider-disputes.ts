import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reverseSellerTransfer } from "@/lib/stripe-payments";

export async function closeProviderPaymentDispute(input:{
 eventId:string;
 disputeId:string;
 status:string;
}){
 const admin=createSupabaseAdminClient();
 let reversalId:string|null=null;

 if(input.status.toLowerCase()==="lost"){
  const {data:caseRow,error:caseError}=await admin
   .from("transaction_cases")
   .select("order_item_id")
   .eq("provider_dispute_id",input.disputeId)
   .maybeSingle();
  if(caseError)throw caseError;

  if(caseRow?.order_item_id){
   const {data:item,error:itemError}=await admin
    .from("order_items")
    .select("id,seller_net_pence,payout_status,funds_released_at,provider_transfer_id,provider_transfer_reversal_id")
    .eq("id",caseRow.order_item_id)
    .maybeSingle();
   if(itemError)throw itemError;

   if(item?.provider_transfer_reversal_id){
    reversalId=item.provider_transfer_reversal_id;
   }else if(
    item?.provider_transfer_id&&
    item.funds_released_at&&
    item.payout_status==="released"
   ){
    const reversal=await reverseSellerTransfer(
     item.provider_transfer_id,
     item.seller_net_pence>0?item.seller_net_pence:undefined,
     "secondpart-provider-dispute-reversal-"+input.disputeId
    );
    reversalId=reversal.id;
   }
  }
 }

 const {data,error}=await admin.rpc("close_provider_payment_dispute",{
  p_event_id:input.eventId,
  p_dispute_id:input.disputeId,
  p_status:input.status,
  p_transfer_reversal_id:reversalId??undefined
 });
 if(error)throw error;
 return {closed:Boolean(data),reversalId};
}
