import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const worker=read("src/lib/commerce-payouts.ts");
const stripe=read("src/lib/stripe-payments.ts");
const stripeConnect=read("src/lib/stripe-connect.ts");
const migration=read("supabase/migrations/20260910082000_payout_transfer_recovery.sql");
const mobileOnboarding=read("src/app/api/mobile/v1/seller/payments/onboarding/route.ts");

const serviceOnlyFunctions=[
 "get_releasing_payout_order_items(integer)",
 "recover_order_item_payout_transfer(uuid,text)",
 "mark_order_item_payout_rollback_required(uuid,text)",
 "finalize_order_item_payout_transfer_rollback(uuid,text,text)",
 "abandon_empty_order_item_payout_release_claim(uuid)"
];

const serviceOnly=serviceOnlyFunctions.every(signature=>
 migration.includes(`revoke all on function public.${signature} from public,anon,authenticated,service_role;`)&&
 migration.includes(`grant execute on function public.${signature} to service_role;`)
);

const checks=[
 ["Recovery RPCs are service-role only",serviceOnly],
 ["Recovery RPCs use SECURITY DEFINER with an empty search_path",(migration.match(/security definer/g)??[]).length>=5&&(migration.match(/set search_path=''/g)??[]).length>=5],
 ["Pre-release rollback clears the current transfer id",migration.includes("provider_transfer_id=null")&&migration.includes("payout_status=next_status")],
 ["Post-release rollback preserves transfer history and marks reversed",migration.includes("provider_transfer_id=coalesce(provider_transfer_id,clean_transfer)")&&migration.includes("payout_status='reversed'")],
 ["Empty unsafe releasing claims can be abandoned atomically",migration.includes("abandon_empty_order_item_payout_release_claim")&&migration.includes("item.payout_status<>'releasing'")],
 ["Worker reconciles releasing payouts before normal due payouts",worker.indexOf("releasingPayoutRpc(admin,safeLimit)")<worker.indexOf('admin.rpc("get_due_payout_order_items"')],
 ["Worker looks up a transfer attempt before creating a new transfer",worker.indexOf("findSellerTransferForAttempt")<worker.indexOf("createSellerTransfer({")],
 ["Transfer attempts rotate after a completed reversal",worker.includes('item.provider_transfer_reversal_id??"initial"')],
 ["Stripe transfer metadata records order item and payout attempt",stripe.includes('metadata[order_item_id]')&&stripe.includes('metadata[payout_attempt]')],
 ["Stripe transfer creation uses attempt-scoped idempotency",stripe.includes('secondpart-transfer-${input.orderItemId}-${attemptTag}')],
 ["Worker checks existing Stripe reversals before a retry",worker.includes("inspectTransferReversal")&&worker.includes("getSellerTransferReversals")],
 ["Partial reversals are deferred for manual reconciliation",worker.includes("partial_reversal_requires_review")&&worker.includes("requires manual reconciliation")],
 ["A recovered full reversal is persisted instead of releasing the payout",worker.includes('reason:"rollback_recovered"')&&worker.includes("finalizeRollback")],
 ["Stripe recipient adapter requires an explicit idempotency key",stripeConnect.includes("idempotencyKey:string")&&stripeConnect.includes('headers:{"Idempotency-Key":input.idempotencyKey.slice(0,255)}')],
 ["Stripe V2 account retrieval uses indexed include parameters",stripeConnect.includes('include.set("include[0]","configuration.recipient")')&&stripeConnect.includes('include.set("include[1]","requirements")')&&!stripeConnect.includes('include.append("include[]"')],
 ["Stripe sandbox onboarding repairs the recipient test phone before creating a link",stripeConnect.includes('const STRIPE_TEST_CONTACT_PHONE="+447400123456"')&&stripeConnect.includes("prepareStripeRecipientForOnboarding")&&stripeConnect.indexOf("await prepareStripeRecipientForOnboarding(accountId)")<stripeConnect.indexOf('stripeV2<StripeAccountLink>("/v2/core/account_links"')&&stripeConnect.includes("contact_phone:STRIPE_TEST_CONTACT_PHONE")],
 ["Mobile Stripe recipient creation is seller-idempotent",mobileOnboarding.includes('idempotencyKey:`secondpart-recipient-${seller.id}`')],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} payout recovery invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSecondPart payout recovery race baseline passed.");
