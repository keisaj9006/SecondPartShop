import { NextResponse } from "next/server";
import { reconcileStripeOrders } from "@/lib/commerce-reconciliation";
import { releaseDuePayouts } from "@/lib/commerce-payouts";
import { syncPendingSellerPaymentAccounts } from "@/lib/seller-payment-sync";
import { dispatchPushOutbox } from "@/lib/push/dispatch";
import { processAccountDeletionQueue } from "@/lib/account-deletion";
import { processPartImageCleanup } from "@/lib/part-image-cleanup";
import { reportOperationalError,reportOperationalWarning } from "@/lib/ops-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,message:"Cron is not configured."},{status:503});
 if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});

 try{
  const [orders,payouts,sellers,deletions]=await Promise.all([
   reconcileStripeOrders(100),
   releaseDuePayouts(100),
   syncPendingSellerPaymentAccounts(100),
   processAccountDeletionQueue(20).catch(async error=>{
    await reportOperationalError({severity:"critical",component:"account_deletion",event:"deletion_queue_failed",error,route:"/api/commerce/maintenance"});
    return {
     checked:0,
     completed:0,
     blocked:0,
     deferred:0,
     failed:1,
     results:[],
     error:error instanceof Error?error.message:"account_deletion_failed"
    };
   })
  ]);
  const push=await dispatchPushOutbox(100).catch(async error=>{
   await reportOperationalError({component:"push",event:"push_dispatch_batch_failed",error,route:"/api/commerce/maintenance"});
   return {
    skipped:false,
    claimed:0,
    sent:0,
    retried:0,
    disabled:0,
    error:error instanceof Error?error.message:"push_dispatch_failed"
   };
  });

  if(payouts.rollbacksDeferred>0){
   await reportOperationalError({
    severity:"critical",
    component:"payout",
    event:"payout_rollback_deferred",
    error:new Error("One or more seller payout rollbacks remain unresolved."),
    route:"/api/commerce/maintenance",
    context:{count:payouts.rollbacksDeferred}
   });
  }
  if(deletions.failed>0){
   await reportOperationalError({
    component:"account_deletion",
    event:"account_deletion_retry_required",
    error:new Error("One or more account deletion requests require retry."),
    route:"/api/commerce/maintenance",
    context:{count:deletions.failed}
   });
  }
  if(push.retried>0){
   reportOperationalWarning({
    component:"push",
    event:"push_delivery_retries",
    message:"Push notifications were deferred for retry.",
    route:"/api/commerce/maintenance",
    context:{count:push.retried}
   });
  }

  const {error:pruneError}=await createSupabaseAdminClient().rpc("prune_ops_client_error_rate_limits");
  if(pruneError){
   reportOperationalWarning({
    component:"commerce_maintenance",
    event:"ops_rate_limit_prune_failed",
    message:"Monitoring rate-limit cleanup was deferred.",
    route:"/api/commerce/maintenance"
   });
  }
  const imageCleanup=await processPartImageCleanup(50);
  return NextResponse.json({ok:true,orders,payouts,sellers,deletions,push,imageCleanup});
 }catch(error){
  await reportOperationalError({severity:"critical",component:"commerce_maintenance",event:"commerce_maintenance_failed",error,route:"/api/commerce/maintenance"});
  return NextResponse.json({ok:false},{status:500});
 }
}
