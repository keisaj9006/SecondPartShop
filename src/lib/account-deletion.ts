import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE=500;

type RequestResult={
 requestId:string;
 status:"completed"|"blocked"|"deferred"|"failed";
 reason?:string;
};

const errorMessage=(error:unknown)=>error instanceof Error?error.message:String(error??"unknown_error");

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

async function identityStillExists(profileId:string){
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin.from("profiles").select("id").eq("id",profileId).maybeSingle();
 if(error)throw error;
 return Boolean(data);
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

  const {error:deleteError}=await admin.auth.admin.deleteUser(profileId,false);
  if(deleteError){
   const stillExists=await identityStillExists(profileId);
   if(stillExists)throw deleteError;
  }

  const {data:completed,error:completeError}=await admin.rpc("complete_account_deletion_request",{p_request_id:requestId});
  if(completeError)throw completeError;
  if(!completed)throw new Error("Deletion completed in Auth but the audit request could not be finalized.");

  return {requestId,status:"completed"};
 }catch(error){
  const stillExists=await identityStillExists(profileId).catch(()=>true);
  if(stillExists){
   await markFailed(requestId,error);
   return {requestId,status:"failed",reason:errorMessage(error)};
  }

  // Auth/profile is already gone. Keep the request in processing so the next
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
