"use server";

import {redirect} from "next/navigation";
import {requireAdmin} from "@/lib/auth";
import {sendCriticalAlertSmokeTest} from "@/lib/ops-monitoring";

export async function runCriticalAlertSmokeTest(){
 await requireAdmin("/admin/system/alerts");
 const result=await sendCriticalAlertSmokeTest();
 const params=new URLSearchParams({
  result:result.delivered?"delivered":"failed",
  reason:result.reason
 });
 if(result.status)params.set("status",String(result.status));
 redirect(`/admin/system/alerts?${params.toString()}`);
}
