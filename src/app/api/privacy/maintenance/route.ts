import { NextResponse } from "next/server";
import { processAccountDeletionQueue,processAccountDeletionRequest } from "@/lib/account-deletion";
import { processPartImageCleanup } from "@/lib/part-image-cleanup";
import { reportOperationalError } from "@/lib/ops-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function processQaTarget(params:URLSearchParams){
 const denied=()=>NextResponse.json({ok:false},{status:404});
 if(process.env.VERCEL_ENV!=="preview"||
  process.env.VERCEL_GIT_COMMIT_REF!=="codex/final-rc-hardening"||
  process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://etkupijfdznljimrfyct.supabase.co")return denied();
 if(params.size!==2||params.get("qa")!=="1"||params.getAll("requestId").length!==1)return denied();
 const requestId=params.get("requestId")??"";
 if(!uuid.test(requestId))return denied();
 let targets:unknown;
 try{targets=JSON.parse(process.env.RC_QA_DELETION_TARGETS??"");}catch{return denied();}
 if(!targets||typeof targets!=="object"||Array.isArray(targets))return denied();
 const entries=Object.entries(targets);
 if(entries.length<1||entries.length>3||entries.some(([id,profile])=>!uuid.test(id)||typeof profile!=="string"||!uuid.test(profile)))return denied();
 const profileId=entries.find(([id])=>id===requestId)?.[1];
 if(!profileId)return denied();

 try{
  const {data:row,error}=await createSupabaseAdminClient().from("account_deletion_requests")
   .select("id,status,profile_id,target_profile_id").eq("id",requestId).maybeSingle();
  if(error)throw error;
  if(!row)return denied();
  // Completion deliberately scrubs both identity columns. The configured exact
  // audit ID can be observed again, but this branch invokes no destructive work.
  if(row.status==="completed"&&row.profile_id===null&&row.target_profile_id===null){
   return NextResponse.json({ok:true,result:{requestId,status:"completed",reason:"already_completed"}});
  }
  if((row.profile_id??row.target_profile_id)!==profileId)return denied();
  const result=await processAccountDeletionRequest(requestId);
  return NextResponse.json({ok:true,result});
 }catch{
  // Scoped QA failures must not fall back to the global queue or dispatch an
  // operational alert to an unrelated configured destination.
  return NextResponse.json({ok:false,message:"Scoped account deletion failed."},{status:500});
 }
}

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,message:"Cron is not configured."},{status:503});
 if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});

 const params=new URL(request.url).searchParams;
 const qaConfigured=process.env.VERCEL_ENV==="preview"&&
  process.env.VERCEL_GIT_COMMIT_REF==="codex/final-rc-hardening"&&process.env.RC_QA_DELETION_TARGETS!==undefined;
 // Any supplied query is an explicit scoped request, including malformed ones.
 // While configured, this Preview branch also refuses accidental bare invokes.
 if(params.size>0||qaConfigured)return processQaTarget(params);

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
