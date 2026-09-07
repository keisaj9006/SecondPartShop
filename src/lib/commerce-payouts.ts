import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSellerTransfer,isStripeCheckoutConfigured,reverseSellerTransfer } from "@/lib/stripe-payments";

const activeCaseStatuses=["open","seller_response","under_review","return_authorized","return_shipped","returned"];

async function completePendingPayoutRollback(
 admin:ReturnType<typeof createSupabaseAdminClient>,
 item:{id:string;seller_net_pence:number;provider_transfer_id:string|null}
){
 if(!item.provider_transfer_id||item.seller_net_pence<=0)return false;
 const reversal=await reverseSellerTransfer(
  item.provider_transfer_id,
  item.seller_net_pence,
  "secondpart-release-rollback-"+item.id
 );
 const {error}=await admin
  .from("order_items")
  .update({
   payout_rollback_required:false,
   provider_transfer_reversal_id:reversal.id
  })
  .eq("id",item.id);
 if(error)throw error;
 return true;
}

export async function releaseDuePayoutItem(orderItemId:string){
 if(!isStripeCheckoutConfigured())return {released:false,reason:"stripe_not_configured"} as const;
 const admin=createSupabaseAdminClient();

 const {data:item,error:itemError}=await admin
  .from("order_items")
  .select("id,order_id,seller_id,seller_net_pence,payout_status,release_eligible_at,funds_released_at,provider_transfer_id,payout_rollback_required,provider_transfer_reversal_id")
  .eq("id",orderItemId)
  .maybeSingle();
 if(itemError||!item)return {released:false,reason:"item_not_found"} as const;

 if(item.payout_rollback_required){
  try{
   const rolledBack=await completePendingPayoutRollback(admin,item);
   return {released:false,reason:rolledBack?"rollback_completed":"rollback_unavailable"} as const;
  }catch{
   return {released:false,reason:"rollback_pending"} as const;
  }
 }

 if(item.funds_released_at||item.payout_status==="released")return {released:true,reason:"already_released"} as const;
 if(!["scheduled","releasing"].includes(item.payout_status)||!item.release_eligible_at||new Date(item.release_eligible_at).getTime()>Date.now()){
  return {released:false,reason:"not_due"} as const;
 }

 const [{data:order},{data:payment},{data:seller}]=await Promise.all([
  admin.from("orders").select("payment_status,provider_charge_id").eq("id",item.order_id).maybeSingle(),
  admin.from("seller_payment_accounts").select("provider_account_id,transfers_enabled").eq("seller_id",item.seller_id).maybeSingle(),
  admin.from("sellers").select("owner_id").eq("id",item.seller_id).maybeSingle()
 ]);

 if(order?.payment_status!=="paid"||!order.provider_charge_id)return {released:false,reason:"payment_not_ready"} as const;
 if(!payment?.provider_account_id||!payment.transfers_enabled)return {released:false,reason:"seller_not_ready"} as const;
 if(item.seller_net_pence<=0)return {released:false,reason:"invalid_amount"} as const;

 const {data:claimed,error:claimError}=await admin.rpc("claim_order_item_payout_release",{p_order_item_id:item.id});
 if(claimError)throw claimError;
 if(!claimed)return {released:false,reason:"not_due"} as const;

 let transfer:{id:string};
 try{
  transfer=await createSellerTransfer({
   orderId:item.order_id,
   orderItemId:item.id,
   amountPence:item.seller_net_pence,
   destinationAccountId:payment.provider_account_id,
   sourceChargeId:order.provider_charge_id
  });
 }catch(error){
  await admin.rpc("reset_order_item_payout_release_claim",{p_order_item_id:item.id});
  throw error;
 }

 const {error:recordTransferError}=await admin
  .from("order_items")
  .update({provider_transfer_id:transfer.id})
  .eq("id",item.id);
 if(recordTransferError)throw recordTransferError;

 const {data:marked,error:markError}=await admin.rpc("mark_order_item_payout_released",{
  p_order_item_id:item.id,
  p_transfer_id:transfer.id
 });

 if(markError||!marked){
  const [{data:latest},{data:latestOrder},{count:activeCases}]=await Promise.all([
   admin.from("order_items").select("payout_status,payout_rollback_required,provider_transfer_id").eq("id",item.id).maybeSingle(),
   admin.from("orders").select("payment_status").eq("id",item.order_id).maybeSingle(),
   admin.from("transaction_cases").select("id",{count:"exact",head:true}).eq("order_item_id",item.id).in("status",activeCaseStatuses)
  ]);

  if(latest?.payout_status==="released")return {released:true,reason:"released"} as const;

  const safeToRetryFinalize=
   latest?.payout_status==="releasing"&&
   latestOrder?.payment_status==="paid"&&
   (activeCases??0)===0&&
   !latest.payout_rollback_required;

  if(safeToRetryFinalize){
   if(markError)throw markError;
   return {released:false,reason:"finalize_pending"} as const;
  }

  try{
   await completePendingPayoutRollback(admin,{
    id:item.id,
    seller_net_pence:item.seller_net_pence,
    provider_transfer_id:transfer.id
   });
  }catch{
   await admin
    .from("order_items")
    .update({
     payout_rollback_required:true,
     provider_transfer_id:transfer.id
    })
    .eq("id",item.id);
   return {released:false,reason:"rollback_pending"} as const;
  }

  return {released:false,reason:"payout_state_changed"} as const;
 }

 if(seller?.owner_id){
  await admin.from("notifications").insert({
   profile_id:seller.owner_id,
   type:"payout_released",
   title:"Seller transfer released",
   body:"SecondPart released the eligible transaction funds to your connected Stripe account.",
   href:"/dashboard/orders",
   dedupe_key:"payout-released:"+item.id
  });
 }

 return {released:true,reason:"released"} as const;
}

export async function releaseDuePayouts(limit=100){
 const admin=createSupabaseAdminClient();

 const {data:rollbackRows,error:rollbackError}=await admin
  .from("order_items")
  .select("id,seller_net_pence,provider_transfer_id")
  .eq("payout_rollback_required",true)
  .not("provider_transfer_id","is",null)
  .limit(Math.max(1,Math.min(limit,500)));
 if(rollbackError)throw rollbackError;

 let rollbacksCompleted=0;
 let rollbacksDeferred=0;
 for(const row of rollbackRows??[]){
  try{
   const done=await completePendingPayoutRollback(admin,row);
   if(done)rollbacksCompleted+=1;else rollbacksDeferred+=1;
  }catch{
   rollbacksDeferred+=1;
  }
 }

 const {data,error}=await admin.rpc("get_due_payout_order_items",{p_limit:limit});
 if(error)throw error;
 let released=0;
 let deferred=0;
 for(const row of data??[]){
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
  rollbackChecked:rollbackRows?.length??0,
  rollbacksCompleted,
  rollbacksDeferred
 };
}
