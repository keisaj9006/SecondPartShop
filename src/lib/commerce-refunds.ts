import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { refundPlatformPayment,reverseSellerTransfer,isStripeCheckoutConfigured } from "@/lib/stripe-payments";

export async function refundTransactionCase(caseId:string){
 if(!isStripeCheckoutConfigured())return {refunded:false,reason:"stripe_not_configured"} as const;

 const admin=createSupabaseAdminClient();
 const {data:caseRow,error:caseError}=await admin
  .from("transaction_cases")
  .select("id,order_item_id,status,provider_refund_id")
  .eq("id",caseId)
  .maybeSingle();
 if(caseError||!caseRow)return {refunded:false,reason:"case_not_found"} as const;
 if(caseRow.provider_refund_id)return {refunded:true,reason:"already_refunded"} as const;
 if(!["open","seller_response","under_review"].includes(caseRow.status))return {refunded:false,reason:"case_closed"} as const;

 const {data:item,error:itemError}=await admin
  .from("order_items")
  .select("id,order_id,quantity,unit_price_pence,shipping_pence,seller_net_pence,payout_status,provider_transfer_id")
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
 let reversalId:string|null=null;

 if(item.provider_transfer_id&&item.payout_status==="released"){
  const reversal=await reverseSellerTransfer(
   item.provider_transfer_id,
   item.seller_net_pence,
   "secondpart-reversal-"+caseId
  );
  reversalId=reversal.id;
 }

 const refund=await refundPlatformPayment({
  paymentIntentId:order.provider_payment_intent_id,
  amountPence:refundPence,
  idempotencyKey:"secondpart-refund-"+caseId
 });

 const {error:finalizeError}=await admin.rpc("finalize_transaction_case_refund",{
  p_case_id:caseId,
  p_refund_id:refund.id,
  p_refund_pence:refundPence,
  p_transfer_reversal_id:reversalId??undefined
 });
 if(finalizeError)throw finalizeError;

 return {refunded:true,reason:"refunded",refundId:refund.id} as const;
}
