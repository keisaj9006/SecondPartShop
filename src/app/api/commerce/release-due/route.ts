import { NextResponse } from "next/server";
import { releaseDuePayouts } from "@/lib/commerce-payouts";
import { reportOperationalError } from "@/lib/ops-monitoring";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,message:"Cron is not configured."},{status:503});
 if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});

 try{
  const result=await releaseDuePayouts(100);
  return NextResponse.json({ok:true,...result});
 }catch(error){
  await reportOperationalError({severity:"critical",component:"payout",event:"payout_release_batch_failed",error,route:"/api/commerce/release-due"});
  return NextResponse.json({ok:false},{status:500});
 }
}
