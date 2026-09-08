import { NextResponse } from "next/server";
import { reconcileStripeOrders } from "@/lib/commerce-reconciliation";
import { releaseDuePayouts } from "@/lib/commerce-payouts";
import { syncPendingSellerPaymentAccounts } from "@/lib/seller-payment-sync";
import { dispatchPushOutbox } from "@/lib/push/dispatch";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,message:"Cron is not configured."},{status:503});
 if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});

 try{
  const [orders,payouts,sellers]=await Promise.all([
   reconcileStripeOrders(100),
   releaseDuePayouts(100),
   syncPendingSellerPaymentAccounts(100)
  ]);
  const push=await dispatchPushOutbox(100).catch(error=>({
   skipped:false,
   claimed:0,
   sent:0,
   retried:0,
   disabled:0,
   error:error instanceof Error?error.message:"push_dispatch_failed"
  }));
  return NextResponse.json({ok:true,orders,payouts,sellers,push});
 }catch{
  return NextResponse.json({ok:false},{status:500});
 }
}
