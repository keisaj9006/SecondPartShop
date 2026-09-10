import fs from "node:fs";

const criticalDispatchFiles=[
 "src/app/api/stripe/webhook/route.ts",
 "src/app/dashboard/orders/actions.ts",
 "src/app/api/mobile/v1/seller/order-items/[orderItemId]/fulfilment/route.ts",
 "src/app/messages/[orderItemId]/actions.ts",
 "src/app/api/mobile/v1/transaction-messages/[orderItemId]/route.ts",
 "src/app/account/orders/actions.ts",
 "src/app/account/cases/actions.ts",
 "src/app/dashboard/cases/actions.ts",
 "src/app/api/mobile/v1/cases/route.ts",
 "src/app/api/mobile/v1/cases/[caseId]/route.ts",
 "src/app/api/mobile/v1/seller/cases/route.ts",
 "src/app/requests/actions.ts",
 "src/app/api/mobile/v1/requests/route.ts",
 "src/app/dashboard/actions.ts",
 "src/app/api/mobile/v1/seller/listings/[partId]/route.ts",
 "src/app/fit/[partId]/actions.ts",
 "src/app/api/mobile/v1/fitting-requests/route.ts",
 "src/app/garage-partner/requests/actions.ts",
 "src/app/account/fitting/actions.ts",
 "src/app/fitting/[requestId]/actions.ts",
 "src/app/api/mobile/v1/garage-partner/requests/route.ts",
 "src/app/api/mobile/v1/fitting-requests/[requestId]/route.ts",
 "src/app/api/mobile/v1/fitting-requests/[requestId]/messages/route.ts",
 "src/app/inbox/start-actions.ts",
 "src/app/inbox/actions.ts",
 "src/app/api/mobile/v1/listings/[partId]/question/route.ts",
 "src/app/api/mobile/v1/inbox/[conversationId]/route.ts",
 "src/app/admin/commerce/actions.ts",
 "src/app/account/orders/checkout-actions.ts"
];

const failures=[];
const read=path=>{
 try{return fs.readFileSync(path,"utf8");}
 catch{failures.push(path+": file missing");return "";}
};

for(const path of criticalDispatchFiles){
 const source=read(path);
 if(!source.includes('from "@/lib/push/schedule"'))failures.push(path+": schedulePushDispatch import missing");
 if(!source.includes("schedulePushDispatch("))failures.push(path+": immediate push dispatch call missing");
}

const schedule=read("src/lib/push/schedule.ts");
if(!schedule.includes('after('))failures.push("push schedule must use Next after() so user responses are not blocked");

const fcm=read("src/lib/push/fcm.ts");
if(!fcm.includes('priority:"HIGH"'))failures.push("Android transactional pushes must use HIGH priority");

const nativeMode=read("src/components/native-app-mode.tsx");
if(!nativeMode.includes("SecondPartNative")||!nativeMode.includes("onReceived")||!nativeMode.includes("router.refresh()")){
 failures.push("native foreground push must refresh hosted application state");
}
if(!nativeMode.includes("onAction")||!nativeMode.includes("notification.data?.href")||!nativeMode.includes("router.push(href)")){
 failures.push("native push action must route the notification href through the hosted application");
}
if(!nativeMode.includes('value.startsWith("/")')||!nativeMode.includes('value.startsWith("//")')||!nativeMode.includes('url.origin!==window.location.origin')){
 failures.push("native push action href must be restricted to a safe same-origin internal path");
}

const smokeAction=read("src/app/admin/system/push-test/actions.ts");
if(!smokeAction.includes('from("notifications")')||!smokeAction.includes('type:"system_push_test"')||!smokeAction.includes("schedulePushDispatch(")){
 failures.push("FCM smoke test must use the normal notifications -> outbox -> dispatcher pipeline");
}
if(!smokeAction.includes("isFcmPushConfigured")){
 failures.push("FCM smoke test must fail closed when Firebase server credentials are unavailable");
}
if(smokeAction.includes("sendFcmPush")||/from\(["']mobile_push_outbox["']\)[\s\S]{0,200}insert\(/.test(smokeAction)){
 failures.push("FCM smoke test must not bypass the production notification pipeline");
}

const smokePage=read("src/app/admin/system/push-test/page.tsx");
if(!smokePage.includes("Server-side delivery is not the physical PASS")){
 failures.push("FCM smoke test UI must not represent server acceptance as physical-device PASS");
}
if(smokePage.includes("token")&&smokePage.includes("select(\"id,profile_id,platform,app_id,build_channel,last_seen_at,updated_at,token\")")){
 failures.push("FCM smoke test UI must not load or expose device tokens");
}

const mobileUi=read("mobile-shell/ui.js");
if(!mobileUi.includes('href.startsWith("/fitting/")')||!mobileUi.includes('route("fittingChat",{id})')){
 failures.push("Buy + Fit push href must open the native fitting chat");
}

const hardening=read("supabase/migrations/20260908200000_mobile_push_delivery_hardening.sql");
if(!hardening.includes("processing_lease_expired")||!hardening.includes("interval '5 minutes'")){
 failures.push("push outbox processing lease recovery invariant missing");
}

const canonicalFindMyPart=read("supabase/migrations/20260908181500_mark_find_my_part_responded_on_publish.sql");
const laterFindMyPart=read("supabase/migrations/20260908201500_part_request_response_on_publish.sql");
for(const [label,source] of [["canonical",canonicalFindMyPart],["later",laterFindMyPart]]){
 if(!source.includes("active")||!source.includes("reserved")||!source.includes("sold")||!source.includes("source_request_id")){
  failures.push("Find My Part "+label+" migration must ignore drafts and preserve active/reserved/sold response semantics");
 }
}

if(failures.length){
 console.error("Notification delivery invariants failed:");
 failures.forEach(failure=>console.error(" - "+failure));
 process.exit(1);
}

console.log("Notification delivery invariants passed for "+criticalDispatchFiles.length+" critical event paths plus native FCM routing and smoke-test safety.");
