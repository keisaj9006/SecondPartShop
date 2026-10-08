"use server";
import {cookies} from "next/headers";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {signHostedPushBinding,verifyHostedPushBinding} from "@/lib/push/hosted-device-binding";
import {detachHostedPushDevice,HOSTED_PUSH_COOKIE} from "@/lib/push/hosted-device";

type Failure={ok:false;message:string};
type Result={ok:true;enabled:boolean}|Failure;
const unavailable=():Failure=>({ok:false,message:"Could not update notifications. Try again."});
const currentUser=async(expectedUserId:string)=>{
 const supabase=await createSupabaseServerClient();
 const {data:{user},error}=await supabase.auth.getUser();
 return !error&&user?.id===expectedUserId?user:null;
};
export async function hostedPushStatus(expectedUserId:string):Promise<Result>{
 try{
  const user=await currentUser(expectedUserId);
  if(!user)return {ok:false,message:"Sign in again to manage notifications."};
  const raw=(await cookies()).get(HOSTED_PUSH_COOKIE)?.value;
  if(!raw)return {ok:true,enabled:false};
  const binding=verifyHostedPushBinding(raw);
  if(!binding)return unavailable();
  const {data,error}=await createSupabaseAdminClient().from("mobile_push_devices").select("profile_id,enabled")
   .eq("id",binding.id).eq("provider","fcm").maybeSingle();
  if(error)return unavailable();
  if(data&&data.profile_id!==user.id)return await detachHostedPushDevice()?{ok:true,enabled:false}:unavailable();
  return {ok:true,enabled:Boolean(data?.enabled)};
 }catch{return unavailable();}
}
export async function prepareHostedPush(expectedUserId:string,input:{token:string;appId:string}):Promise<{ok:true;version:string}|Failure>{
 try{
  const user=await currentUser(expectedUserId);
  if(!user)return {ok:false,message:"Sign in again to enable notifications."};
  if(typeof input?.token!=="string"||input.token.length<20||input.token.length>4096||
   !["com.secondpart.marketplace","com.secondpart.marketplace.preview"].includes(input.appId))return unavailable();
  if(!await detachHostedPushDevice())return unavailable();
  const admin=createSupabaseAdminClient();
  let device:{id:string;updated_at:string}|null=null;
  for(let attempt=0;attempt<3;attempt++){
   const {data:existing,error:readError}=await admin.from("mobile_push_devices").select("id,updated_at")
    .eq("provider","fcm").eq("token",input.token).maybeSingle();
   if(readError)return unavailable();
   const previous=existing?Date.parse(existing.updated_at):0;
   if(!Number.isFinite(previous))return unavailable();
   const version=new Date(Math.max(Date.now(),previous+1)).toISOString();
   const fields={
    profile_id:user.id,provider:"fcm",platform:"android",token:input.token,app_id:input.appId,
    build_channel:input.appId.endsWith(".preview")?"preview":"release",enabled:false,last_seen_at:version,updated_at:version
   };
   if(existing){
    // A paused preparation must not overwrite a newer cleanup fence or staged version.
    const {data,error}=await admin.from("mobile_push_devices").update(fields)
     .eq("id",existing.id).eq("provider","fcm").eq("token",input.token).eq("updated_at",existing.updated_at).select("id,updated_at");
    if(error||!Array.isArray(data))return unavailable();
    if(data.length===1){device=data[0];break;}
   }else{
    const {data,error}=await admin.from("mobile_push_devices").insert(fields).select("id,updated_at").single();
    if(!error&&data){device=data;break;}
    if(error?.code!=="23505")return unavailable();
   }
  }
  if(!device)return unavailable();
  // First deliver the signed disabled registration to the browser. Aborted responses cannot enable it.
  const stagedVersion=Date.parse(device.updated_at);
  (await cookies()).set(HOSTED_PUSH_COOKIE,signHostedPushBinding(device.id,stagedVersion),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:31536000});
  return {ok:true,version:new Date(stagedVersion).toISOString()};
 }catch{return unavailable();}
}
export async function confirmHostedPush(expectedUserId:string,version:string):Promise<Result>{
 try{
  const user=await currentUser(expectedUserId);
  if(!user)return {ok:false,message:"Sign in again to enable notifications."};
  const raw=(await cookies()).get(HOSTED_PUSH_COOKIE)?.value;
  const binding=raw?verifyHostedPushBinding(raw):null;
  if(!binding||typeof version!=="string"||Date.parse(version)!==binding.version)return unavailable();
  const {data,error}=await createSupabaseAdminClient().from("mobile_push_devices")
   .update({enabled:true,last_seen_at:new Date().toISOString()}).eq("id",binding.id).eq("profile_id",user.id)
   .eq("provider","fcm").eq("enabled",false).eq("updated_at",new Date(binding.version).toISOString()).select("id");
  return error||!Array.isArray(data)||data.length!==1?unavailable():{ok:true,enabled:true};
 }catch{return unavailable();}
}
export async function disableHostedPush(expectedUserId:string):Promise<Result>{
 try{
  if(!await currentUser(expectedUserId))return {ok:false,message:"Sign in again to manage notifications."};
  return await detachHostedPushDevice()?{ok:true,enabled:false}:unavailable();
 }catch{return unavailable();}
}
