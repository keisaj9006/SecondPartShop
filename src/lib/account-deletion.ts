import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE=500;
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestResult={
 requestId:string;
 status:"completed"|"blocked"|"deferred"|"failed";
 reason?:string;
};

export type AccountDeletionQaPreflight=
 |{found:false;reason:"invalid_request_id"|"request_missing"}
 |{
   found:true;
   requestId:string;
   profileId:string|null;
   status:string;
   blockerCode:string|null;
   attemptCount:number;
   requestedAt:string;
   processingStartedAt:string|null;
   completedAt:string|null;
   processorErrorPresent:boolean;
   profileExists:boolean;
   authIdentity:"present"|"missing"|"unknown";
   workerCandidate:boolean;
   identityDetached:boolean;
  };

const errorMessage=(error:unknown)=>error instanceof Error?error.message:String(error??"unknown_error");
const authUserMissing=(error:{status?:number;message?:string})=>
 error.status===404||/user.*not found|not found.*user/i.test(error.message??"");

async function markFailed(requestId:string,error:unknown){
 const admin=createSupabaseAdminClient();
 try{
  await admin.rpc("fail_account_deletion_request",{
   p_request_id:requestId,
   p_error:errorMessage(error).slice(0,500)
  });
 }catch{
  // Best-effort audit update. The original processing failure remains primary.
 }
}

export async function getAccountDeletionQaPreflight(requestId:string):Promise<AccountDeletionQaPreflight>{
 const normalized=requestId.trim();
 if(!UUID_PATTERN.test(normalized))return {found:false,reason:"invalid_request_id"};

 const admin=createSupabaseAdminClient();
 const {data:request,error}=await admin
  .from("account_deletion_requests")
  .select("id,status,profile_id,target_profile_id,blocker_code,attempt_count,requested_at,processing_started_at,completed_at,last_error")
  .eq("id",normalized)
  .maybeSingle();

 if(error)throw error;
 if(!request)return {found:false,reason:"request_missing"};

 const profileId=request.profile_id??request.target_profile_id;
 let profileExists=false;
 let authIdentity:"present"|"missing"|"unknown"=profileId?"unknown":"missing";

 if(profileId){
  const {data:profile,error:profileError}=await admin.from("profiles").select("id").eq("id",profileId).maybeSingle();
  if(profileError)throw profileError;
  profileExists=Boolean(profile);

  const {data:authData,error:authError}=await admin.auth.admin.getUserById(profileId);
  if(!authError){
   authIdentity=authData.user?"present":"missing";
  }else if(authUserMissing(authError)){
   authIdentity="missing";
  }
 }

 return {
  found:true,
  requestId:request.id,
  profileId,
  status:request.status,
  blockerCode:request.blocker_code,
  attemptCount:request.attempt_count,
  requestedAt:request.requested_at,
  processingStartedAt:request.processing_started_at,
  completedAt:request.completed_at,
  processorErrorPresent:Boolean(request.last_error),
  profileExists,
  authIdentity,
  workerCandidate:["requested","blocked","failed","processing"].includes(request.status),
  identityDetached:request.profile_id===null&&Boolean(request.target_profile_id)
 };
}

async function purgePartImages(requestId:string){
 const admin=createSupabaseAdminClient();
 let deleted=0;

 for(;;){
  const {data,error}=await admin.rpc("get_account_deletion_part_image_paths",{
   p_request_id:requestId,
   p_limit:BATCH_SIZE
  });
  if(error)throw error;

  const paths=(data??[]).map(row=>row.storage_path).filter(Boolean);
  if(!paths.length)break;

  const {error:storageError}=await admin.storage.from("part-images").remove(paths);
  if(storageError)throw storageError;

  const {error:rowError}=await admin.from("part_images").delete().in("storage_path",paths);
  if(rowError)throw rowError;

  deleted+=paths.length;
  if(paths.length<BATCH_SIZE)break;
 }

 return deleted;
}

async function authIdentityStillExists(profileId:string){
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin.auth.admin.getUserById(profileId);
 if(!error)return Boolean(data.user);
 if(authUserMissing(error))return false;
 throw error;
}

async function ensureAuthIdentityDeleted(profileId:string){
 const existsBefore=await authIdentityStillExists(profileId);
 if(!existsBefore)return;

 const admin=createSupabaseAdminClient();
 const {error:deleteError}=await admin.auth.admin.deleteUser(profileId,false);
 if(deleteError){
  const stillExists=await authIdentityStillExists(profileId).catch(()=>true);
  if(stillExists)throw deleteError;
 }

 const stillExists=await authIdentityStillExists(profileId).catch(()=>true);
 if(stillExists)throw new Error("Auth identity still exists after account deletion request.");
}

export async function processAccountDeletionRequest(requestId:string):Promise<RequestResult>{
 const admin=createSupabaseAdminClient();
 const {data:request,error:requestError}=await admin
  .from("account_deletion_requests")
  .select("id,status,profile_id,target_profile_id")
  .eq("id",requestId)
  .maybeSingle();

 if(requestError)throw requestError;
 if(!request)return {requestId,status:"deferred",reason:"request_missing"};
 if(request.status==="completed")return {requestId,status:"completed",reason:"already_completed"};
 if(request.status==="cancelled")return {requestId,status:"deferred",reason:"cancelled"};

 let profileId=request.profile_id??request.target_profile_id;
 if(!profileId)return {requestId,status:"deferred",reason:"identity_missing"};

 if(request.profile_id===null&&request.status==="processing"){
  // A previous attempt may have removed the profile row before the Auth call
  // was conclusively observed. Re-check Auth directly and finish/retry the
  // hard deletion instead of assuming profile detachment means Auth deletion.
  try{
   await ensureAuthIdentityDeleted(profileId);
  }catch(error){
   return {requestId,status:"deferred",reason:"auth_deletion_retry_pending:"+errorMessage(error)};
  }

  const {data:completed,error}=await admin.rpc("complete_account_deletion_request",{p_request_id:requestId});
  if(error)throw error;
  return {requestId,status:completed?"completed":"deferred",reason:completed?"identity_already_deleted":"completion_not_claimed"};
 }

 if(request.status!=="processing"){
  const {data:claim,error:claimError}=await admin.rpc("claim_account_deletion_request",{p_request_id:requestId});
  if(claimError)throw claimError;
  const claimed=claim?.[0];
  if(!claimed?.claimed){
   return {
    requestId,
    status:claimed?.blocker_code==="identity_already_deleted"?"deferred":"blocked",
    reason:claimed?.blocker_code??"not_claimed"
   };
  }
  profileId=claimed.profile_id??profileId;
 }

 try{
  await purgePartImages(requestId);

  const {data:prepared,error:prepareError}=await admin.rpc("prepare_claimed_account_deletion",{
   p_request_id:requestId,
   p_profile_id:profileId
  });
  if(prepareError)throw prepareError;
  if(!prepared)return {requestId,status:"blocked",reason:"blocker_detected_during_final_preflight"};

  await ensureAuthIdentityDeleted(profileId);

  const {data:completed,error:completeError}=await admin.rpc("complete_account_deletion_request",{p_request_id:requestId});
  if(completeError)throw completeError;
  if(!completed)throw new Error("Deletion completed in Auth but the audit request could not be finalized.");

  return {requestId,status:"completed"};
 }catch(error){
  const stillExists=await authIdentityStillExists(profileId).catch(()=>true);
  if(stillExists){
   await markFailed(requestId,error);
   return {requestId,status:"failed",reason:errorMessage(error)};
  }

  // Auth identity is already gone. Keep the request in processing so the next
  // pass can safely finish the audit row instead of falsely recreating identity.
  return {requestId,status:"deferred",reason:"identity_deleted_audit_finalize_pending"};
 }
}

export async function processAccountDeletionQueue(limit=20){
 const admin=createSupabaseAdminClient();
 const safeLimit=Math.max(1,Math.min(limit,50));
 const {data,error}=await admin.rpc("get_account_deletion_processing_queue",{p_limit:safeLimit});
 if(error)throw error;

 const results:RequestResult[]=[];
 for(const row of data??[]){
  try{
   results.push(await processAccountDeletionRequest(row.request_id));
  }catch(error){
   await markFailed(row.request_id,error);
   results.push({requestId:row.request_id,status:"failed",reason:errorMessage(error)});
  }
 }

 return {
  checked:data?.length??0,
  completed:results.filter(item=>item.status==="completed").length,
  blocked:results.filter(item=>item.status==="blocked").length,
  deferred:results.filter(item=>item.status==="deferred").length,
  failed:results.filter(item=>item.status==="failed").length,
  results
 };
}
