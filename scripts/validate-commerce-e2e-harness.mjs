import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const diagnostic=read("src/lib/data/commerce-e2e.ts");
const page=read("src/app/admin/commerce/e2e/page.tsx");
const commerceAdminPage=read("src/app/admin/commerce/page.tsx");
const systemPage=read("src/app/admin/system/page.tsx");
const runbook=read("docs/commerce-e2e-runbook.md");
const evidenceTemplate=read("docs/test-runs/commerce-e2e-template.md");
const normalizedRunbook=runbook.toLowerCase();
const sellerPaymentSync=read("src/lib/seller-payment-sync.ts");
const sellerPaymentActions=read("src/app/dashboard/payments/actions.ts");
const sellerPaymentPage=read("src/app/dashboard/payments/page.tsx");
const stripeConnect=read("src/lib/stripe-connect.ts");

const forbiddenMutations=[".insert(",".update(",".upsert(",".delete(","auth.admin.deleteUser","cancel_checkout_order","claim_order_item_payout_release","mark_order_item_payout_released"];
const isReadOnly=forbiddenMutations.every(token=>!diagnostic.includes(token));

const checks=[
 ["Commerce E2E diagnostic must remain read-only",isReadOnly],
 ["Diagnostic must require a valid order UUID",diagnostic.includes("isUuid(orderId)")],
 ["Preflight must fail closed unless Stripe API credentials are test-mode",diagnostic.includes("getStripeApiMode")&&diagnostic.includes('key.startsWith("sk_test_")')&&diagnostic.includes('key.startsWith("rk_test_")')&&diagnostic.includes('stripeApiMode==="live"')&&diagnostic.includes("Release QA is blocked")],
 ["Preflight must require Stripe webhook signing configuration",diagnostic.includes("STRIPE_WEBHOOK_SECRET")&&diagnostic.includes('startsWith("whsec_")')&&diagnostic.includes("stripeWebhookConfigured")],
 ["Preflight must require a safe HTTPS site origin",diagnostic.includes("isSafeHttpsUrl")&&diagnostic.includes("NEXT_PUBLIC_SITE_URL")&&diagnostic.includes('url.protocol==="https:"')&&diagnostic.includes("siteUrlConfigured")],
 ["Preflight must check for a buyer account",diagnostic.includes('from("profiles")')&&diagnostic.includes('.eq("role","buyer")')&&diagnostic.includes("buyerProfiles<1")],
 ["Preflight must use aggregate checkout readiness instead of loading all active listings",diagnostic.includes('rpc("admin_active_listing_checkout_readiness")')&&diagnostic.includes("checkout_ready_listings")&&!diagnostic.includes('from("parts").select("seller_id",{count:"exact"}).eq("status","active")')],
 ["Preflight must check payout-ready sellers",diagnostic.includes('onboarding_status","complete"')&&diagnostic.includes('transfers_enabled",true')&&diagnostic.includes('payouts_enabled",true')&&diagnostic.includes("provider_account_id")],
 ["Preflight must require an active listing owned by a payout-ready seller",diagnostic.includes("checkoutReadyListings<1")&&diagnostic.includes("checkoutReadyListings")],
 ["Preflight must probe the deployed payout recovery schema",diagnostic.includes('rpc("get_releasing_payout_order_items",{p_limit:1})')&&diagnostic.includes("payoutRecoveryReady")],
 ["Paid orders must require Stripe payment references",diagnostic.includes("provider_payment_intent_id")&&diagnostic.includes("provider_charge_id")&&diagnostic.includes("paid_at")],
 ["Paid orders must require persisted payment/audit events",diagnostic.includes('event_type==="checkout_paid"')&&diagnostic.includes('event_type==="payment_confirmed"')],
 ["Order/item money snapshots must reconcile",diagnostic.includes("expectedSubtotal")&&diagnostic.includes("expectedShipping")&&diagnostic.includes("expectedFees")],
 ["Shipping fulfilment must verify dispatch evidence",diagnostic.includes("dispatched_at")&&diagnostic.includes("tracking_number")],
 ["Buyer receipt must verify receipt timestamps",diagnostic.includes("buyer_received_at")&&diagnostic.includes("delivered_at")],
 ["Payout scheduling must require release eligibility",diagnostic.includes("release_eligible_at")],
 ["Active transaction cases must gate payout",diagnostic.includes("activeCaseStatuses")&&diagnostic.includes("unsafeRelease")],
 ["Released payout must require transfer evidence",diagnostic.includes("provider_transfer_id")&&diagnostic.includes("funds_released_at")],
 ["Unresolved payout rollback must fail verification",diagnostic.includes("payout_rollback_required")],
 ["Admin page must explicitly describe verifier as read-only",page.includes("Read-only verification")&&page.includes("never advances fulfilment")],
 ["Admin page must visibly block Stripe LIVE mode without exposing credentials",page.includes("LIVE — blocked")&&page.includes("Stripe LIVE mode detected")&&page.includes("Secret values are never shown here")],
 ["Admin page must expose strict preflight readiness",page.includes("readyForRealE2E")&&page.includes("preflight.blockers")&&page.includes("Stripe API mode")&&page.includes("Webhook signing")&&page.includes("HTTPS site origin")&&page.includes("Buyer accounts")&&page.includes("Checkout-ready listings")&&page.includes("Payout recovery")],
 ["Commerce operations must link to the E2E verifier",commerceAdminPage.includes('href="/admin/commerce/e2e"')&&commerceAdminPage.includes("E2E verifier")],
 ["System readiness must link directly to Commerce E2E",systemPage.includes('href="/admin/commerce/e2e"')&&systemPage.includes("Commerce E2E")],
 ["Canonical Stripe seller sync must persist complete payout readiness",sellerPaymentSync.includes("payouts_enabled:active")&&sellerPaymentSync.includes("transfers_enabled:active")],
 ["Manual Stripe refresh must persist the same payout readiness",sellerPaymentActions.includes("payouts_enabled:complete")&&sellerPaymentActions.includes("transfers_enabled:complete")],
 ["Stripe onboarding return must trigger an automatic status sync",sellerPaymentPage.includes("syncSellerPaymentAccount")&&sellerPaymentPage.includes("returned&&configured")],
 ["Stripe recipient creation must require an idempotency key",stripeConnect.includes("idempotencyKey:string")&&stripeConnect.includes('"Idempotency-Key"')],
 ["Seller onboarding must use a stable seller-scoped idempotency key",sellerPaymentActions.includes("secondpart-recipient-${seller.id}")],
 ["Seller onboarding and sync failures must be monitored",sellerPaymentActions.includes("seller_stripe_onboarding_start_failed")&&sellerPaymentActions.includes("seller_stripe_status_sync_failed")],
 ["Runbook must cover happy path and major failure paths",runbook.includes("Scenario A")&&runbook.includes("Scenario D")&&runbook.includes("Scenario E")&&runbook.includes("Scenario F")&&runbook.includes("Scenario G")],
 ["Runbook must prohibit manual state forcing",normalizedRunbook.includes("never manually forced")&&normalizedRunbook.includes("do not simulate readiness")],
 ["Runbook must explicitly prohibit live-money QA",runbook.includes("must show Stripe test mode")&&runbook.includes("Do not run release QA with `sk_live_`")&&runbook.includes("never display or record the credential value")],
 ["Runbook must require provider transfer evidence",runbook.includes("provider_transfer_id")&&runbook.includes("seller_transfer_released")],
 ["Runbook must include webhook idempotency",runbook.includes("Webhook idempotency gate")],
 ["Commerce evidence template alone must never count as a PASS",evidenceTemplate.includes("This template by itself is not release evidence and is not a PASS")],
 ["Commerce evidence template must prohibit live-money and manual state forcing",evidenceTemplate.includes("Never use `sk_live_` / `rk_live_`")&&evidenceTemplate.includes("Do not manually edit order/payment/payout/stock states")],
 ["Commerce evidence template must cover scenarios A-G",["### A —","### B —","### C —","### D —","### E —","### F —","### G —"].every(marker=>evidenceTemplate.includes(marker))],
 ["Commerce evidence template must exclude sensitive QA evidence",evidenceTemplate.includes("webhook secrets")&&evidenceTemplate.includes("test card numbers/CVCs")&&evidenceTemplate.includes("full personal addresses")],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} commerce E2E harness invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSecondPart commerce E2E harness baseline passed.");
