import {timingSafeEqual} from "node:crypto";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {sendFcmPush} from "@/lib/push/fcm";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const authorized=(request:Request)=>{
 const secret=String(process.env.PUSH_DISPATCH_SECRET??process.env.CRON_SECRET??"").trim();
 if(!secret)return false;
 const header=String(request.headers.get("authorization")??"");
 const provided=header.toLowerCase().startsWith("bearer ")?header.slice(7).trim():"";
 if(!provided||provided.length!==secret.length)return false;
 return timingSafeEqual(Buffer.from(provided),Buffer.from(secret));
};

const retryAt=(attempts:number)=>{
 const minutes=Math.min(30,Math.max(1,2**Math.max(0,attempts-1)));
 return new Date(Date.now()+minutes*60*1000).toISOString();
};

async function dispatch(request:Request){
 if(!String(process.env.PUSH_DISPATCH_SECRET??process.env.CRON_SECRET??"").trim()){
  return Response.json({ok:false,error:"push_dispatch_not_configured"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
 if(!authorized(request))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});

 const admin=createSupabaseAdminClient();
 const {data:claimed,error:claimError}=await admin.rpc("claim_mobile_push_outbox",{p_limit:20});
 if(claimError)return Response.json({ok:false,error:"push_claim_failed"},{status:503,headers:{"Cache-Control":"no-store"}});
 const rows=claimed??[];
 if(!rows.length)return Response.json({ok:true,claimed:0,sent:0,retried:0,disabled:0},{headers:{"Cache-Control":"no-store"}});

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
  return Response.json({ok:false,error:"push_dependencies_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
 }

 const notificationById=new Map((notifications??[]).map(item=>[item.id,item] as const));
 const deviceById=new Map((devices??[]).map(item=>[item.id,item] as const));
 let sent=0,retried=0,disabled=0;

 for(const row of rows){
  const notification=notificationById.get(row.notification_id);
  const device=deviceById.get(row.device_id);
  if(!notification||!device||notification.profile_id!==row.profile_id||device.profile_id!==row.profile_id||!device.enabled){
   await admin.from("mobile_push_outbox").update({
    status:"sent",
    last_error:device&&!device.enabled?"device_disabled":"push_target_missing",
    updated_at:new Date().toISOString()
   }).eq("id",row.id);
   continue;
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
    sent+=1;
    await admin.from("mobile_push_outbox").update({status:"sent",last_error:null,updated_at:new Date().toISOString()}).eq("id",row.id);
   }else if(result.invalidToken){
    disabled+=1;
    await Promise.all([
     admin.from("mobile_push_devices").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",device.id),
     admin.from("mobile_push_outbox").update({status:"sent",last_error:"device_unregistered",updated_at:new Date().toISOString()}).eq("id",row.id)
    ]);
   }else{
    retried+=1;
    await admin.from("mobile_push_outbox").update({
     status:"failed",
     next_attempt_at:retryAt(row.attempts),
     last_error:result.error,
     updated_at:new Date().toISOString()
    }).eq("id",row.id);
   }
  }catch(error){
   retried+=1;
   const code=error instanceof Error&&["firebase_push_not_configured","firebase_service_account_invalid","firebase_oauth_failed"].includes(error.message)
    ?error.message
    :"push_send_failed";
   await admin.from("mobile_push_outbox").update({
    status:"failed",
    next_attempt_at:retryAt(row.attempts),
    last_error:code,
    updated_at:new Date().toISOString()
   }).eq("id",row.id);
  }
 }

 return Response.json({ok:true,claimed:rows.length,sent,retried,disabled},{headers:{"Cache-Control":"no-store"}});
}

export async function GET(request:Request){return dispatch(request);}
export async function POST(request:Request){return dispatch(request);}
