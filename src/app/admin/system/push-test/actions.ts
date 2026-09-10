"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/identifiers";
import { isFcmPushConfigured } from "@/lib/push/fcm";
import { schedulePushDispatch } from "@/lib/push/schedule";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function queueFcmSmokeTest(formData:FormData){
 await requireAdmin("/admin/system/push-test");
 if(!isFcmPushConfigured())redirect("/admin/system/push-test?error=firebase-not-configured");
 const deviceId=String(formData.get("deviceId")??"").trim();
 if(!isUuid(deviceId))redirect("/admin/system/push-test?error=invalid-device");

 const admin=createSupabaseAdminClient();
 const {data:device,error:deviceError}=await admin
  .from("mobile_push_devices")
  .select("id,profile_id,enabled")
  .eq("id",deviceId)
  .eq("enabled",true)
  .maybeSingle();
 if(deviceError)redirect("/admin/system/push-test?error=device-load");
 if(!device)redirect("/admin/system/push-test?error=device-missing");

 const {data:notification,error:notificationError}=await admin
  .from("notifications")
  .insert({
   profile_id:device.profile_id,
   type:"system_push_test",
   title:"SecondPart notification test",
   body:"Release-candidate FCM smoke test. No action is required.",
   href:"/notifications",
   dedupe_key:`system-push-test:${randomUUID()}`
  })
  .select("id")
  .single();
 if(notificationError||!notification)redirect("/admin/system/push-test?error=queue");

 schedulePushDispatch(50);
 revalidatePath("/admin/system/push-test");
 revalidatePath("/admin/system");
 redirect(`/admin/system/push-test?notification=${notification.id}`);
}
