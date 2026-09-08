import "server-only";

import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {isFcmPushConfigured,sendFcmPush} from "@/lib/push/fcm";

export type PushDispatchResult={
 skipped:boolean;
 claimed:number;
 sent:number;
 retried:number;
 disabled:number;
};

const CONCURRENCY=5;

const retryAt=(attempts:number)=>{
 const minutes=Math.min(30,Math.max(1,2**Math.max(0,attempts-1)));
 return new Date(Date.now()+minutes*60*1000).toISOString();
};

export async function dispatchPushOutbox(limit=20):Promise<PushDispatchResult>{
 if(!isFcmPushConfigured())return {skipped:true,claimed:0,sent:0,retried:0,disabled:0};

 const admin=createSupabaseAdminClient();
 const safeLimit=Math.max(1,Math.min(Math.floor(limit),100));
 const {data:claimed,error:claimError}=await admin.rpc("claim_mobile_push_outbox",{p_limit:safeLimit});
 if(claimError)throw new Error("push_claim_failed");
 const rows=claimed??[];
 if(!rows.length)return {skipped:false,claimed:0,sent:0,retried:0,disabled:0};

 const notificationIds=[...new Set(rows.map(row=>row.notification_id))];
 const deviceIds=[...new Set(rows.map(row=>row.device_id))];
 const [{data:notifications,error:notificationError},{data:devices,error:deviceError}]=await Promise.all([
  admin.from("notifications").select("id,profile_id,title,body,href").in("id",notificationIds),
  admin.from("mobile_push_devices").select("id,profile_id,token,enabled").in("id",deviceIds)
 ]);

 if(notificationError||deviceError){
  await Promise.all(rows.map(row=>admin.from("mobile_push_outbox").update({
   status:"failed",
   next_attempt_at:retryAt(row.attempts),
   last_error:"push_dependencies_unavailable",
   updated_at:new Date().toISOString()
  }).eq("id",row.id)));
  throw new Error("push_dependencies_unavailable");
 }

 const notificationById=new Map((notifications??[]).map(item=>[item.id,item] as const));
 const deviceById=new Map((devices??[]).map(item=>[item.id,item] as const));

 const processRow=async(row:(typeof rows)[number])=>{
  const notification=notificationById.get(row.notification_id);
  const device=deviceById.get(row.device_id);
  if(!notification||!device||notification.profile_id!==row.profile_id||device.profile_id!==row.profile_id||!device.enabled){
   await admin.from("mobile_push_outbox").update({
    status:"sent",
    last_error:device&&!device.enabled?"device_disabled":"push_target_missing",
    updated_at:new Date().toISOString()
   }).eq("id",row.id);
   return {sent:0,retried:0,disabled:0};
  }

  try{
   const result=await sendFcmPush({
    token:device.token,
    notificationId:notification.id,
    title:notification.title,
    body:notification.body,
    href:notification.href
   });
   if(result.ok){
    await admin.from("mobile_push_outbox").update({status:"sent",last_error:null,updated_at:new Date().toISOString()}).eq("id",row.id);
    return {sent:1,retried:0,disabled:0};
   }
   if(result.invalidToken){
    await Promise.all([
     admin.from("mobile_push_devices").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",device.id),
     admin.from("mobile_push_outbox").update({status:"sent",last_error:"device_unregistered",updated_at:new Date().toISOString()}).eq("id",row.id)
    ]);
    return {sent:0,retried:0,disabled:1};
   }

   await admin.from("mobile_push_outbox").update({
    status:"failed",
    next_attempt_at:retryAt(row.attempts),
    last_error:result.error,
    updated_at:new Date().toISOString()
   }).eq("id",row.id);
   return {sent:0,retried:1,disabled:0};
  }catch{
   await admin.from("mobile_push_outbox").update({
    status:"failed",
    next_attempt_at:retryAt(row.attempts),
    last_error:"push_send_failed",
    updated_at:new Date().toISOString()
   }).eq("id",row.id);
   return {sent:0,retried:1,disabled:0};
  }
 };

 let sent=0,retried=0,disabled=0;
 for(let index=0;index<rows.length;index+=CONCURRENCY){
  const results=await Promise.all(rows.slice(index,index+CONCURRENCY).map(processRow));
  for(const result of results){
   sent+=result.sent;
   retried+=result.retried;
   disabled+=result.disabled;
  }
 }

 return {skipped:false,claimed:rows.length,sent,retried,disabled};
}
