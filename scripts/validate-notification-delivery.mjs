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

const hardening=read("supabase/migrations/20260908200000_mobile_push_delivery_hardening.sql");
if(!hardening.includes("processing_lease_expired")||!hardening.includes("interval '5 minutes'")){
 failures.push("push outbox processing lease recovery invariant missing");
}

const findMyPart=read("supabase/migrations/20260908201500_part_request_response_on_publish.sql");
if(!findMyPart.includes("new.status::text<>'active'")||!findMyPart.includes("update of status,source_request_id")){
 failures.push("Find My Part response must be counted only on active publication");
}

if(failures.length){
 console.error("Notification delivery invariants failed:");
 failures.forEach(failure=>console.error(" - "+failure));
 process.exit(1);
}

console.log("Notification delivery invariants passed for "+criticalDispatchFiles.length+" critical event paths.");
