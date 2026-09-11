import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { attemptPartImageCleanup,requirePartImageCleanupReady } from "@/lib/part-image-cleanup";

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
 await requirePartImageCleanupReady();
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

  // Metadata removal atomically records authorization. Already detached paths
  // also arrive here from the private outbox via the discovery RPC.
  const {error:rowError}=await admin.from("part_images").delete().in("storage_path",paths);
  if(rowError)throw rowError;
  for(const path of paths){
   if(!await attemptPartImageCleanup(path))throw new Error("Part image cleanup remains pending.");
  }

  deleted+=paths.length;
  if(paths.length<BATCH_SIZE)break;
 }

 return deleted;
}

// The claimed deletion request is the durable authority for this owner-prefix
// purge. It also catches uploads whose attachment AND orphan-queue RPC failed.
// Never accept a caller-provided prefix: profileId comes from the saved request.
async function purgeUntrackedPartImages(profileId:string){
 if(!UUID_PATTERN.test(profileId))throw new Error("Invalid image cleanup owner.");
 const admin=createSupabaseAdminClient();
 const root=profileId.toLowerCase();
 let removed=0;
 let reads=0;
 async function drain(folder:string,depth:number):Promise<void>{
  if(depth>16||!(folder===root||folder.startsWith(root+"/")))throw new Error("Invalid image cleanup folder.");
  for(;;){
   if(++reads>1000)throw new Error("Image cleanup traversal requires retry.");
   // Deletion changes pagination. Always drain page zero to avoid skipped keys.
   const {data,error}=await admin.storage.from("part-images").list(folder,{limit:100,offset:0,sortBy:{column:"name",order:"asc"}});
   if(error)throw new Error("Image cleanup listing failed.");
   if(!data?.length)return;
   const files:string[]=[];
   const folders:string[]=[];
   for(const item of data){
    if(!item.name||item.name==="."||item.name===".."||/[\\/\u0000-\u001f]/.test(item.name))throw new Error("Invalid image cleanup object name.");
    const path=folder+"/"+item.name;
    if(item.id)files.push(path);else folders.push(path);
   }
   if(removed+files.length>500)throw new Error("Image cleanup batch requires retry.");
   if(files.length){
    const {error:removeError}=await admin.storage.from("part-images").remove(files);
    if(removeError)throw new Error("Untracked image cleanup remains pending.");
    removed+=files.length;
   }
   for(const child of folders)await drain(child,depth+1);
  }
 }
 await drain(root,0);
 return removed;
}

const safeEvidenceExtension=(path:string)=>{
 const fileName=path.split("/").pop()??"";
 const match=fileName.match(/(\.[a-z0-9]{1,10})$/i);
 return match?.[1]?.toLowerCase()??"";
};

async function storageObjectExists(bucket:string,path:string){
 const admin=createSupabaseAdminClient();
 const slash=path.lastIndexOf("/");
 const folder=slash>=0?path.slice(0,slash):"";
 const fileName=slash>=0?path.slice(slash+1):path;
 const {data,error}=await admin.storage.from(bucket).list(folder,{limit:10,search:fileName});
 if(error)throw error;
 return (data??[]).some(object=>object.name===fileName);
}

async function detachRetainedCaseEvidence(profileId:string){
 const admin=createSupabaseAdminClient();
 let offset=0;
 let moved=0;

 for(;;){
  const {data,error}=await admin
   .from("transaction_case_evidence")
   .select("id,case_id,storage_path")
   .eq("uploader_profile_id",profileId)
   .order("id")
   .range(offset,offset+BATCH_SIZE-1);
  if(error)throw error;

  const rows=data??[];
  for(const row of rows){
   const extension=safeEvidenceExtension(row.storage_path);
   const targetPath=`${row.case_id}/retained/${row.id}${extension}`;

   if(row.storage_path!==targetPath){
    const {error:moveError}=await admin.storage.from("case-evidence").move(row.storage_path,targetPath);
    if(moveError){
     const targetExists=await storageObjectExists("case-evidence",targetPath).catch(()=>false);
     if(!targetExists)throw moveError;
    }else{
     moved+=1;
    }
   }

   const {error:updateError}=await admin
    .from("transaction_case_evidence")
    .update({
     storage_path:targetPath,
     original_name:`retained-evidence${extension}`
    })
    .eq("id",row.id)
    .eq("uploader_profile_id",profileId);
   if(updateError)throw updateError;
  }

  if(rows.length<BATCH_SIZE)break;
  offset+=rows.length;
 }

 return moved;
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
   await purgePartImages(requestId);
   await purgeUntrackedPartImages(profileId);
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
  await detachRetainedCaseEvidence(profileId);

  const {data:prepared,error:prepareError}=await admin.rpc("prepare_claimed_account_deletion",{
   p_request_id:requestId,
   p_profile_id:profileId
  });
  if(prepareError)throw prepareError;
  if(!prepared)return {requestId,status:"blocked",reason:"blocker_detected_during_final_preflight"};

  // Preparation may remove residual metadata through the same durable trigger.
  // Drain that intent before deleting identity, including on resumed attempts.
  await purgePartImages(requestId);
  await purgeUntrackedPartImages(profileId);
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
