import { NextResponse } from "next/server";
import { processAccountDeletionQueue } from "@/lib/account-deletion";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,message:"Cron is not configured."},{status:503});
 if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});

 try{
  const result=await processAccountDeletionQueue(20);
  return NextResponse.json({ok:true,...result});
 }catch(error){
  return NextResponse.json({
   ok:false,
   message:error instanceof Error?error.message:"Account deletion maintenance failed."
  },{status:500});
 }
}
