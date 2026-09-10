import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const exists=(path)=>fs.existsSync(path);

const ops=read("src/lib/ops-monitoring.ts");
const serverInstrumentation=read("src/instrumentation.ts");
const clientInstrumentation=read("src/instrumentation-client.ts");
const clientEndpoint=read("src/app/api/ops/client-error/route.ts");
const checkout=read("src/app/checkout/actions.ts");
const mobileCheckout=read("src/app/api/mobile/v1/checkout/route.ts");
const stripeWebhook=read("src/app/api/stripe/webhook/route.ts");
const maintenance=read("src/app/api/commerce/maintenance/route.ts");
const payoutCron=read("src/app/api/commerce/release-due/route.ts");
const privacyMaintenance=read("src/app/api/privacy/maintenance/route.ts");
const limiter=read("supabase/migrations/20260909235930_ops_client_error_rate_limit.sql");
const alertAction=read("src/app/admin/system/alerts/actions.ts");
const alertPage=read("src/app/admin/system/alerts/page.tsx");
const env=read(".env.example");
const runbook=read("docs/operations-monitoring.md");

const checks=[
 ["Structured server logger must emit a stable operations marker",ops.includes("SECOND_PART_OPS")&&ops.includes('type:"secondpart_ops"')],
 ["Operations logger must sanitise obvious sensitive values",ops.includes("redacted-email")&&ops.includes("redacted-token")&&ops.includes("redacted-id")],
 ["Critical alert forwarding must remain optional and best-effort at runtime",ops.includes("OPS_ALERT_WEBHOOK_URL")&&ops.includes("sendCriticalAlert")&&ops.includes("ALERT_DELIVERY_FAILED")],
 ["Critical alert delivery must reject invalid/non-HTTPS destinations",ops.includes('reason:"invalid_url"')&&ops.includes('url.protocol!=="https:"')],
 ["Critical alert delivery must treat non-2xx as failure",ops.includes("response.ok")&&ops.includes('reason:"http_error"')&&ops.includes("response.status")],
 ["Critical alert smoke test must use a fixed server-side event",ops.includes("sendCriticalAlertSmokeTest")&&ops.includes('event:"manual_alert_smoke_test"')&&ops.includes("SecondPart production critical-alert smoke test.")],
 ["Critical alert smoke action must be admin-only",alertAction.includes('requireAdmin("/admin/system/alerts")')&&alertAction.includes("sendCriticalAlertSmokeTest")],
 ["Critical alert smoke action must expose only result metadata",alertAction.includes("result:result.delivered")&&alertAction.includes("reason:result.reason")&&!alertAction.includes("OPS_ALERT_WEBHOOK_URL")&&!alertAction.includes("OPS_ALERT_WEBHOOK_TOKEN")],
 ["Critical alert smoke page must not accept arbitrary alert content",alertPage.includes("predefined SecondPart critical-alert test record")&&alertPage.includes("does not accept arbitrary message content")],
 ["Critical alert smoke page must require real destination confirmation",alertPage.includes("Confirm the SecondPart smoke-test message is visible")],
 ["Next.js uncaught request errors must be captured",serverInstrumentation.includes("onRequestError")&&serverInstrumentation.includes("uncaught_request_error")],
 ["Browser runtime and unhandled rejection errors must be captured",clientInstrumentation.includes('addEventListener("error"')&&clientInstrumentation.includes('addEventListener("unhandledrejection"')],
 ["Client error endpoint must be same-origin and payload bounded",clientEndpoint.includes("sameOrigin")&&clientEndpoint.includes("content-length")&&clientEndpoint.includes("8192")],
 ["Client error endpoint must use the database rate limiter",clientEndpoint.includes("consume_ops_client_error_rate_limit")&&clientEndpoint.includes("sha256")],
 ["Browser limiter table must have RLS and no client table grants",limiter.includes("enable row level security")&&limiter.includes("revoke all on public.ops_client_error_rate_limits from anon,authenticated")],
 ["Browser limiter RPC must be service-role only",limiter.includes("consume_ops_client_error_rate_limit(text,integer,integer) from public,anon,authenticated,service_role")&&limiter.includes("to service_role")],
 ["Web checkout setup failure must rollback reservation and alert",checkout.includes("checkout_reservation_rollback_failed")&&checkout.includes("checkout_setup_failed")&&checkout.includes("cancel_checkout_order")],
 ["Mobile checkout setup failure must rollback reservation and alert",mobileCheckout.includes("mobile_checkout_reservation_rollback_failed")&&mobileCheckout.includes("mobile_checkout_setup_failed")],
 ["Stripe webhook failures must be critical monitoring events",stripeWebhook.includes("stripe_webhook_processing_failed")&&stripeWebhook.includes('severity:"critical"')],
 ["Commerce maintenance must surface payout/deletion/push failures",maintenance.includes("payout_rollback_deferred")&&maintenance.includes("account_deletion_retry_required")&&maintenance.includes("push_delivery_retries")],
 ["Payout release cron failures must be monitored",payoutCron.includes("payout_release_batch_failed")],
 ["Privacy maintenance failures must be monitored",privacyMaintenance.includes("privacy_maintenance_failed")],
 ["Monitoring alert environment must be documented",env.includes("OPS_ALERT_WEBHOOK_URL")&&env.includes("OPS_ALERT_WEBHOOK_KIND")&&env.includes("OPS_ALERT_WEBHOOK_TOKEN")],
 ["Operations runbook must document verifiable admin smoke testing",exists("docs/operations-monitoring.md")&&runbook.includes("/admin/system/alerts")&&runbook.includes("HTTP 2xx")&&runbook.includes("visibly confirmed")],
 ["Operations runbook must retain incident-priority guidance",runbook.includes("Incident priority")&&runbook.includes("SECOND_PART_OPS")],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} operations monitoring invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSecondPart operations monitoring baseline passed.");
