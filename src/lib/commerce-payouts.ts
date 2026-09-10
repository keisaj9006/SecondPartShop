import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
 createSellerTransfer,
 findSellerTransferForAttempt,
 isStripeCheckoutConfigured,
 reverseSellerTransfer,
 type StripeTransfer
} from "@/lib/stripe-payments";

const activeCaseStatuses=["open","seller_response","under_review","return_authorized","return_shipped","returned"];

type PayoutItem={
 id:string;
 order_id:string;
 seller_id:string;
 seller_net_pence:number;
 payout_status:string;
 release_eligible_at:string|null;
 funds_released_at:string|null;
 provider_transfer_id:string|null;
 payout_rollback_required:boolean;
 provider_transfer_reversal_id:string|null;
};

type PayoutSafety={
 safe:boolean;
 orderPaymentStatus:string|null;
 sourceChargeId:string|null;
 destinationAccountId:string|null;
 sellerTransferReady:boolean;
 activeCaseCount:number;
};

const payoutAttemptTag=(item:Pick<PayoutItem,"provider_transfer_reversal_id">)=>item.provider_transfer_reversal_id??"initial";
const firstReversalId=(transfer:StripeTransfer)=>transfer.reversals?.data?.[0]?.id??null;

async function loadPayoutSafety(admin:ReturnType<typeof createSupabaseAdminClient>,item:PayoutItem):Promise<PayoutSafety>{
 const [orderResult,paymentResult,caseResult]=await Promise.all([
  admin.from("orders").select("payment_status,provider_charge_id").eq("id",item.order_id).maybeSingle(),
  admin.from("seller_payment_accounts").select("provider_account_id,transfers_enabled,onboarding_status").eq("seller_id",item.seller_id).maybeSingle(),
  admin.from("transaction_cases").select("id",{count:"exact",head:true}).eq("order_item_id",item.id).in("status",activeCaseStatuses)
 ]);
 if(orderResult.error)throw orderResult.error;
 if(paymentResult.error)throw paymentResult.error;
 if(caseResult.error)throw caseResult.error;

 const order=orderResult.data;
 const payment=paymentResult.data;
 const activeCaseCount=caseResult.count??0;
 const sellerTransferReady=Boolean(payment?.provider_account_id&&payment.transfers_enabled&&payment.onboarding_status==="complete");
 const due=Boolean(item.release_eligible_at&&new Date(item.release_eligible_at).getTime()<=Date.now());
 const safe=Boolean(
  order?.payment_status==="paid"&&
  order.provider_charge_id&&
  sellerTransferReady&&
  item.seller_net_pence>0&&
  due&&
  activeCaseCount===0&&
  !item.payout_rollback_required
 );

 return {
  safe,
  orderPaymentStatus:order?.payment_status??null,
  sourceChargeId:order?.provider_charge_id??null,
  destinationAccountId:payment?.provider_account_id??null,
  sellerTransferReady,
  activeCaseCount
 };
}

async function finalizeRollback(
 admin:ReturnType<typeof createSupabaseAdminClient>,
 item:PayoutItem,
 transferId:string,
 reversalId:string
){
 const {data,error}=await admin.rpc("finalize_order_item_payout_transfer_rollback",{
  p_order_item_id:item.id,
  p_transfer_id:transferId,
  p_reversal_id:reversalId
 });
 if(error)throw error;
 if(!data)throw new Error("Payout transfer rollback could not be finalized in the database.");
 return true;
}

async function completePendingPayoutRollback(
 admin:ReturnType<typeof createSupabaseAdminClient>,
 item:PayoutItem,
 transferId=item.provider_transfer_id
){
 if(!transferId||item.seller_net_pence<=0)return false;

 const {data:marked,error:markError}=await admin.rpc("mark_order_item_payout_rollback_required",{
  p_order_item_id:item.id,
  p_transfer_id:transferId
 });
 if(markError)throw markError;
 if(!marked)return false;

 const reversal=await reverseSellerTransfer(
  transferId,
  item.seller_net_pence,
  `secondpart-release-rollback-${item.id}-${transferId}`.slice(0,255)
 );
 await finalizeRollback(admin,item,transferId,reversal.id);
 return true;
}

async function persistRecoveredTransfer(
 admin:ReturnType<typeof createSupabaseAdminClient>,
 item:PayoutItem,
 transferId:string
){
 const {data,error}=await admin.rpc("recover_order_item_payout_transfer",{
  p_order_item_id:item.id,
  p_transfer_id:transferId
 });
 if(error)throw error;
 if(!data)throw new Error("Recovered Stripe transfer could not be attached to the payout claim.");
 item.provider_transfer_id=transferId;
}

async function abandonEmptyClaim(admin:ReturnType<typeof createSupabaseAdminClient>,item:PayoutItem){
 const {error}=await admin.rpc("abandon_empty_order_item_payout_release_claim",{p_order_item_id:item.id});
 if(error)throw error;
}

async function markReleased(
 admin:ReturnType<typeof createSupabaseAdminClient>,
 item:PayoutItem,
 transferId:string
){
 const markResult=await admin.rpc("mark_order_item_payout_released",{
  p_order_item_id:item.id,
  p_transfer_id:transferId
 });
 if(!markResult.error&&markResult.data)return {released:true,reason:"released"} as const;

 const [latestResult,latestOrderResult,caseResult]=await Promise.all([
  admin.from("order_items").select("payout_status,payout_rollback_required,provider_transfer_id,funds_released_at").eq("id",item.id).maybeSingle(),
  admin.from("orders").select("payment_status").eq("id",item.order_id).maybeSingle(),
  admin.from("transaction_cases").select("id",{count:"exact",head:true}).eq("order_item_id",item.id).in("status",activeCaseStatuses)
 ]);
 if(latestResult.error)throw latestResult.error;
 if(latestOrderResult.error)throw latestOrderResult.error;
 if(caseResult.error)throw caseResult.error;

 const latest=latestResult.data;
 const latestOrder=latestOrderResult.data;
 const activeCases=caseResult.count??0;
 if(latest?.payout_status==="released"&&latest.funds_released_at)return {released:true,reason:"released"} as const;

 const safeToRetryFinalize=
  latest?.payout_status==="releasing"&&
  latestOrder?.payment_status==="paid"&&
  activeCases===0&&
  !latest.payout_rollback_required&&
  latest.provider_transfer_id===transferId;

 if(safeToRetryFinalize){
  if(markResult.error)throw markResult.error;
  return {released:false,reason:"finalize_pending"} as const;
 }

 const rollbackItem:{
  id:string;
  order_id:string;
  seller_id:string;
  seller_net_pence:number;
  payout_status:string;
  release_eligible_at:string|null;
  funds_released_at:string|null;
  provider_transfer_id:string|null;
  payout_rollback_required:boolean;
  provider_transfer_reversal_id:string|null;
 }={
  ...item,
  payout_status:latest?.payout_status??item.payout_status,
  funds_released_at:latest?.funds_released_at??item.funds_released_at,
  provider_transfer_id:latest?.provider_transfer_id??transferId,
  payout_rollback_required:latest?.payout_rollback_required??item.payout_rollback_required
 };

 try{
  const rolledBack=await completePendingPayoutRollback(admin,rollbackItem,transferId);
  return {released:false,reason:rolledBack?"rollback_completed":"rollback_unavailable"} as const;
 }catch{
  return {released:false,reason:"rollback_pending"} as const;
 }
}

async function recoverOrCreateTransfer(
 admin:ReturnType<typeof createSupabaseAdminClient>,
 item:PayoutItem,
 safety:PayoutSafety
){
 const attemptTag=payoutAttemptTag(item);

 let transfer:StripeTransfer|null=null;
 if(item.provider_transfer_id){
  transfer={
   id:item.provider_transfer_id,
   amount:item.seller_net_pence,
   currency:"gbp",
   destination:safety.destinationAccountId??"unknown"
  };
 }else if(safety.destinationAccountId){
  transfer=await findSellerTransferForAttempt({
   orderId:item.order_id,
   orderItemId:item.id,
   amountPence:item.seller_net_pence,
   destinationAccountId:safety.destinationAccountId,
   attemptTag
  });

  if(transfer){
   const reversalId=firstReversalId(transfer);
   if(transfer.reversed&&reversalId){
    await finalizeRollback(admin,item,transfer.id,reversalId);
    return {released:false,reason:"rollback_recovered"} as const;
   }
   if(transfer.reversed&&!reversalId){
    return {released:false,reason:"reversal_evidence_missing"} as const;
   }
   await persistRecoveredTransfer(admin,item,transfer.id);
  }
 }

 if(!transfer){
  if(!safety.safe){
   await abandonEmptyClaim(admin,item);
   return {released:false,reason:"claim_abandoned_unsafe"} as const;
  }
  if(!safety.destinationAccountId||!safety.sourceChargeId){
   await abandonEmptyClaim(admin,item);
   return {released:false,reason:"provider_context_missing"} as const;
  }

  transfer=await createSellerTransfer({
   orderId:item.order_id,
   orderItemId:item.id,
   amountPence:item.seller_net_pence,
   destinationAccountId:safety.destinationAccountId,
   sourceChargeId:safety.sourceChargeId,
   attemptTag
  });
  await persistRecoveredTransfer(admin,item,transfer.id);
 }

 if(!safety.safe){
  try{
   const rolledBack=await completePendingPayoutRollback(admin,item,transfer.id);
   return {released:false,reason:rolledBack?"rollback_completed":"rollback_unavailable"} as const;
  }catch{
   return {released:false,reason:"rollback_pending"} as const;
  }
 }

 return markReleased(admin,item,transfer.id);
}

export async function releaseDuePayoutItem(orderItemId:string){
 if(!isStripeCheckoutConfigured())return {released:false,reason:"stripe_not_configured"} as const;
 const admin=createSupabaseAdminClient();

 const {data:itemRow,error:itemError}=await admin
  .from("order_items")
  .select("id,order_id,seller_id,seller_net_pence,payout_status,release_eligible_at,funds_released_at,provider_transfer_id,payout_rollback_required,provider_transfer_reversal_id")
  .eq("id",orderItemId)
  .maybeSingle();
 if(itemError||!itemRow)return {released:false,reason:"item_not_found"} as const;
 const item=itemRow as PayoutItem;

 if(item.funds_released_at||item.payout_status==="released")return {released:true,reason:"already_released"} as const;

 if(item.payout_rollback_required&&item.provider_transfer_id){
  try{
   const rolledBack=await completePendingPayoutRollback(admin,item);
   return {released:false,reason:rolledBack?"rollback_completed":"rollback_unavailable"} as const;
  }catch{
   return {released:false,reason:"rollback_pending"} as const;
  }
 }

 const due=Boolean(item.release_eligible_at&&new Date(item.release_eligible_at).getTime()<=Date.now());
 if(item.payout_status==="scheduled"){
  if(!due)return {released:false,reason:"not_due"} as const;
  const {data:claimed,error:claimError}=await admin.rpc("claim_order_item_payout_release",{p_order_item_id:item.id});
  if(claimError)throw claimError;
  if(!claimed)return {released:false,reason:"not_due"} as const;
  item.payout_status="releasing";
 }

 if(item.payout_status!=="releasing")return {released:false,reason:"not_due"} as const;

 const safety=await loadPayoutSafety(admin,item);
 return recoverOrCreateTransfer(admin,item,safety);
}

export async function releaseDuePayouts(limit=100){
 const admin=createSupabaseAdminClient();
 const safeLimit=Math.max(1,Math.min(limit,500));

 const {data:rollbackRows,error:rollbackError}=await admin
  .from("order_items")
  .select("id,order_id,seller_id,seller_net_pence,payout_status,release_eligible_at,funds_released_at,provider_transfer_id,payout_rollback_required,provider_transfer_reversal_id")
  .eq("payout_rollback_required",true)
  .not("provider_transfer_id","is",null)
  .limit(safeLimit);
 if(rollbackError)throw rollbackError;

 let rollbacksCompleted=0;
 let rollbacksDeferred=0;
 const processed=new Set<string>();
 for(const row of rollbackRows??[]){
  processed.add(row.id);
  try{
   const done=await completePendingPayoutRollback(admin,row as PayoutItem);
   if(done)rollbacksCompleted+=1;else rollbacksDeferred+=1;
  }catch{
   rollbacksDeferred+=1;
  }
 }

 const {data:releasingRows,error:releasingError}=await admin.rpc("get_releasing_payout_order_items",{p_limit:safeLimit});
 if(releasingError)throw releasingError;
 let recoveredReleasing=0;
 let reconciliationDeferred=0;
 for(const row of releasingRows??[]){
  if(processed.has(row.order_item_id))continue;
  processed.add(row.order_item_id);
  try{
   const result=await releaseDuePayoutItem(row.order_item_id);
   if(result.released||["rollback_completed","rollback_recovered","claim_abandoned_unsafe"].includes(result.reason))recoveredReleasing+=1;
   else reconciliationDeferred+=1;
  }catch{
   reconciliationDeferred+=1;
  }
 }

 const {data,error}=await admin.rpc("get_due_payout_order_items",{p_limit:safeLimit});
 if(error)throw error;
 let released=0;
 let deferred=0;
 for(const row of data??[]){
  if(processed.has(row.order_item_id))continue;
  try{
   const result=await releaseDuePayoutItem(row.order_item_id);
   if(result.released)released+=1;else deferred+=1;
  }catch{
   deferred+=1;
  }
 }
 return {
  checked:data?.length??0,
  released,
  deferred,
  releasingChecked:releasingRows?.length??0,
  recoveredReleasing,
  reconciliationDeferred,
  rollbackChecked:rollbackRows?.length??0,
  rollbacksCompleted,
  rollbacksDeferred
 };
}
