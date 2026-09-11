import { NextResponse } from "next/server";
import { processAccountDeletionQueue } from "@/lib/account-deletion";
import { processPartImageCleanup } from "@/lib/part-image-cleanup";
import { reportOperationalError } from "@/lib/ops-monitoring";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,message:"Cron is not configured."},{status:503});
 if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});

 try{
  const result=await processAccountDeletionQueue(20);
  const imageCleanup=await processPartImageCleanup(50);
  return NextResponse.json({ok:true,...result,imageCleanup});
 }catch(error){
  await reportOperationalError({severity:"critical",component:"account_deletion",event:"privacy_maintenance_failed",error,route:"/api/privacy/maintenance"});
  return NextResponse.json({
   ok:false,
   message:error instanceof Error?error.message:"Account deletion maintenance failed."
  },{status:500});
 }
}
