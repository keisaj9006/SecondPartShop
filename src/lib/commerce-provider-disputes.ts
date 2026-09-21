import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reverseSellerTransfer,getSellerTransferReversal,getSellerTransferReversals,type StripeTransferReversal } from "@/lib/stripe-payments";

export async function closeProviderPaymentDispute(input:{
 eventId:string;
 disputeId:string;
 status:string;
}){
 const status=input.status.toLowerCase();
 if(!["won","warning_closed","lost"].includes(status)){
  throw new Error("Provider dispute terminal outcome is unsupported.");
 }
 const admin=createSupabaseAdminClient();
 const {data:caseRow,error:caseError}=await admin
  .from("transaction_cases")
  .select("order_item_id,status,provider_dispute_status")
  .eq("provider_dispute_id",input.disputeId)
  .maybeSingle();
 if(caseError)throw caseError;
 if(!caseRow?.order_item_id)throw new Error("Provider dispute case linkage is not ready.");
 const previousOutcome=caseRow.provider_dispute_status?.toLowerCase();
 // Check before any irreversible provider operation, not only during SQL close.
 if(caseRow.status==="resolved"&&previousOutcome&&
    ["won","warning_closed","lost"].includes(previousOutcome)&&previousOutcome!==status){
  throw new Error("Provider dispute terminal outcome conflicts with existing history.");
 }
 let reversalId:string|null=null;

 if(status==="lost"){
  const {data:item,error:itemError}=await admin
   .from("order_items")
   .select("id,seller_net_pence,payout_status,funds_released_at,provider_transfer_id,provider_transfer_reversal_id")
   .eq("id",caseRow.order_item_id)
   .maybeSingle();
  if(itemError)throw itemError;

  if(!item)throw new Error("Provider dispute item linkage is not ready.");
  if(item.funds_released_at||["released","reversed"].includes(item.payout_status)){
   // The committed claim is the only authorization to POST. A missing RPC or
   // ambiguous outcome fails closed; no fallback to the old provider mutation.
   const {data:claims,error:claimError}=await admin.rpc("claim_provider_dispute_reversal",{p_dispute_id:input.disputeId});
   if(claimError)throw claimError;
   const claim=claims?.[0];
   if(!claim||claim.transfer_id!==item.provider_transfer_id||claim.amount_pence!==item.seller_net_pence||claim.amount_pence<=0){
    throw new Error("Provider reversal claim does not match payout evidence.");
   }
   const valid=(reversal:StripeTransferReversal,correlated:boolean)=>{
    const transfer=typeof reversal?.transfer==="string"?reversal.transfer:reversal?.transfer?.id;
    return typeof reversal?.id==="string"&&Boolean(reversal.id.trim())&&reversal.amount===claim.amount_pence&&
     reversal.currency==="gbp"&&transfer===claim.transfer_id&&
     (!correlated||reversal.metadata?.secondpart_dispute_id===input.disputeId);
   };
   let reversal:StripeTransferReversal;
   if(claim.reversal_id){
    reversal=await getSellerTransferReversal(claim.transfer_id,claim.reversal_id);
    if(!valid(reversal,false)||reversal.id!==claim.reversal_id)throw new Error("Stored reversal evidence could not be verified.");
   }else if(claim.claimed===true){
    reversal=await reverseSellerTransfer(claim.transfer_id,claim.amount_pence,
     "secondpart-provider-dispute-reversal-"+input.disputeId,input.disputeId);
    if(!valid(reversal,true))throw new Error("Provider reversal evidence does not match the claim.");
   }else{
    // A provider request may still be in flight, or its response may have been
    // lost days ago. Absence from this bounded read never authorizes a new POST.
    const list=await getSellerTransferReversals(claim.transfer_id);
    if(list?.has_more!==false||!Array.isArray(list.data))throw new Error("Reversal evidence is incomplete; reconciliation is required.");
    const matches=list.data.filter(row=>row.metadata?.secondpart_dispute_id===input.disputeId);
    if(matches.length!==1||!valid(matches[0],true))throw new Error("Reversal outcome is unknown; reconciliation is required.");
    reversal=matches[0];
   }
   const {data:recorded,error:recordError}=await admin.rpc("record_provider_dispute_reversal",{
    p_dispute_id:input.disputeId,p_transfer_id:claim.transfer_id,p_reversal_id:reversal.id,p_amount_pence:reversal.amount
   });
   if(recordError)throw recordError;
   if(recorded!==true)throw new Error("Reversal evidence was not durably recorded.");
   reversalId=reversal.id;
  }
 }

 const {data,error}=await admin.rpc("close_provider_payment_dispute",{
  p_event_id:input.eventId,
  p_dispute_id:input.disputeId,
  p_status:input.status,
  p_transfer_reversal_id:reversalId??undefined
 });
 if(error)throw error;
 if(data!==true)throw new Error("Provider dispute close was not durably acknowledged.");
 return {closed:true,reversalId};
}
