import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRefund,refundPlatformPayment,reverseSellerTransfer,isStripeCheckoutConfigured } from "@/lib/stripe-payments";

const ACTIVE_CASE_STATUSES=["open","seller_response","under_review"];
type AdminClient=ReturnType<typeof createSupabaseAdminClient>;

async function persistRefundCorrelation(admin:AdminClient,caseId:string,currentRefundId:string|null,refundId:string){
 if(currentRefundId){
  if(currentRefundId!==refundId)throw new Error("Refund provider correlation mismatch.");
  return currentRefundId;
 }

 const {data,error}=await admin
  .from("transaction_cases")
  .update({provider_refund_id:refundId})
  .eq("id",caseId)
  .is("provider_refund_id",null)
  .select("provider_refund_id")
  .maybeSingle();
 if(error)throw error;
 if(data?.provider_refund_id===refundId)return refundId;

 const {data:existing,error:existingError}=await admin
  .from("transaction_cases")
  .select("provider_refund_id")
  .eq("id",caseId)
  .maybeSingle();
 if(existingError)throw existingError;
 if(existing?.provider_refund_id!==refundId){
  throw new Error("Refund provider correlation could not be persisted.");
 }
 return refundId;
}

async function persistTransferReversal(admin:AdminClient,orderItemId:string,reversalId:string){
 const {data,error}=await admin
  .from("order_items")
  .update({provider_transfer_reversal_id:reversalId,payout_status:"reversed"})
  .eq("id",orderItemId)
  .is("provider_transfer_reversal_id",null)
  .select("provider_transfer_reversal_id")
  .maybeSingle();
 if(error)throw error;
 if(data?.provider_transfer_reversal_id)return data.provider_transfer_reversal_id;

 const {data:existing,error:existingError}=await admin
  .from("order_items")
  .select("provider_transfer_reversal_id")
  .eq("id",orderItemId)
  .maybeSingle();
 if(existingError)throw existingError;
 if(!existing?.provider_transfer_reversal_id){
  throw new Error("Seller transfer reversal correlation could not be persisted.");
 }
 return existing.provider_transfer_reversal_id;
}

export async function refundTransactionCase(caseId:string){
 if(!isStripeCheckoutConfigured())return {refunded:false,reason:"stripe_not_configured"} as const;

 const admin=createSupabaseAdminClient();
 const {data:caseRow,error:caseError}=await admin
  .from("transaction_cases")
  .select("id,order_item_id,status,provider_refund_id,provider_dispute_id")
  .eq("id",caseId)
  .maybeSingle();
 if(caseError||!caseRow)return {refunded:false,reason:"case_not_found"} as const;
 if(caseRow.provider_dispute_id)return {refunded:false,reason:"provider_dispute_managed"} as const;
 if(caseRow.status==="resolved"&&caseRow.provider_refund_id)return {refunded:true,reason:"already_refunded"} as const;
 if(!ACTIVE_CASE_STATUSES.includes(caseRow.status))return {refunded:false,reason:"case_closed"} as const;

 const {data:item,error:itemError}=await admin
  .from("order_items")
  .select("id,order_id,quantity,unit_price_pence,shipping_pence,seller_net_pence,payout_status,funds_released_at,provider_transfer_id,provider_transfer_reversal_id")
  .eq("id",caseRow.order_item_id)
  .maybeSingle();
 if(itemError||!item)return {refunded:false,reason:"item_not_found"} as const;

 const {data:order,error:orderError}=await admin
  .from("orders")
  .select("provider_payment_intent_id,payment_status")
  .eq("id",item.order_id)
  .maybeSingle();
 if(orderError||!order?.provider_payment_intent_id)return {refunded:false,reason:"payment_not_found"} as const;

 const refundPence=item.unit_price_pence*item.quantity+item.shipping_pence;
 let reversalId:string|null=item.provider_transfer_reversal_id??null;
 const payoutWasReleased=Boolean(item.funds_released_at)||item.payout_status==="released";

 if(payoutWasReleased&&!item.provider_transfer_id){
  return {refunded:false,reason:"payout_reconciliation_required"} as const;
 }

 if(payoutWasReleased&&item.provider_transfer_id&&!reversalId){
  const reversal=await reverseSellerTransfer(
   item.provider_transfer_id,
   item.seller_net_pence,
   "secondpart-reversal-"+caseId
  );
  reversalId=await persistTransferReversal(admin,item.id,reversal.id);
 }

 const refund=caseRow.provider_refund_id
  ?await getRefund(caseRow.provider_refund_id)
  :await refundPlatformPayment({
    paymentIntentId:order.provider_payment_intent_id,
    amountPence:refundPence,
    idempotencyKey:"secondpart-refund-"+caseId
   });

 if(!refund.id)throw new Error("Stripe refund response did not contain an id.");
 await persistRefundCorrelation(admin,caseId,caseRow.provider_refund_id,refund.id);

 const refundStatus=String(refund.status??"").toLowerCase();
 if(refundStatus==="pending"||refundStatus==="requires_action"){
  return {refunded:false,reason:"refund_pending",refundId:refund.id,status:refundStatus} as const;
 }
 if(refundStatus==="failed"||refundStatus==="canceled"){
  return {refunded:false,reason:"refund_failed",refundId:refund.id,status:refundStatus} as const;
 }
 if(refundStatus!=="succeeded"){
  return {refunded:false,reason:"refund_unverified",refundId:refund.id,status:refundStatus||"unknown"} as const;
 }

 const refundCurrency="currency" in refund&&typeof refund.currency==="string"?refund.currency.toLowerCase():null;
 const refundPaymentIntent="payment_intent" in refund&&typeof refund.payment_intent==="string"?refund.payment_intent:null;
 if(
  refund.amount!==refundPence||
  refundCurrency!=="gbp"||
  refundPaymentIntent!==order.provider_payment_intent_id
 ){
  return {refunded:false,reason:"refund_unverified",refundId:refund.id,status:refundStatus} as const;
 }

 const {data:finalized,error:finalizeError}=await admin.rpc("finalize_transaction_case_refund",{
  p_case_id:caseId,
  p_refund_id:refund.id,
  p_refund_pence:refundPence,
  p_transfer_reversal_id:reversalId??undefined
 });
 if(finalizeError)throw finalizeError;
 if(finalized!==true)throw new Error("Refund finalization did not confirm durable state.");

 return {refunded:true,reason:"refunded",refundId:refund.id} as const;
}
