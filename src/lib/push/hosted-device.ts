import "server-only";
import {cookies} from "next/headers";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {verifyHostedPushBinding} from "@/lib/push/hosted-device-binding";

export const HOSTED_PUSH_COOKIE="secondpart_push_device";
export async function detachHostedPushDevice(){
 const jar=await cookies();
 const raw=jar.get(HOSTED_PUSH_COOKIE)?.value;
 if(!raw)return true;
 const binding=verifyHostedPushBinding(raw);
 if(!binding)return false;
 try{
  const admin=createSupabaseAdminClient();
  for(let attempt=0;attempt<3;attempt++){
   const {data:device,error:readError}=await admin.from("mobile_push_devices").select("id,updated_at")
    .eq("id",binding.id).eq("provider","fcm").maybeSingle();
   if(readError)return false;
   if(!device){jar.delete(HOSTED_PUSH_COOKIE);return true;}
   const currentVersion=Date.parse(device.updated_at);
   if(!Number.isFinite(currentVersion))return false;
   const fence=new Date(Math.max(Date.now(),currentVersion+1,binding.version+1)).toISOString();
   // Version CAS prevents an already-dispatched final-enable from reviving this association.
   const {data,error}=await admin.from("mobile_push_devices").update({enabled:false,updated_at:fence})
    .eq("id",binding.id).eq("provider","fcm").eq("updated_at",device.updated_at).select("id");
   if(error||!Array.isArray(data))return false;
   if(data.length===1){jar.delete(HOSTED_PUSH_COOKIE);return true;}
  }
  return false;
 }catch{return false;}
}
