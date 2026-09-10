import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/identifiers";

export type CommerceE2ECheckStatus="pass"|"pending"|"fail"|"info";
export type CommerceE2EStripeMode="test"|"live"|"missing"|"unknown";
export type CommerceE2ECheck={
 id:string;
 label:string;
 status:CommerceE2ECheckStatus;
 detail:string;
 orderItemId?:string;
};

export type CommerceE2EEvent={
 id:string;
 source:"order"|"payment"|"case";
 type:string;
 createdAt:string;
 orderItemId:string|null;
 detail:string;
};

export type CommerceE2EItem={
 id:string;
 partId:string;
 partTitle:string;
 sellerId:string;
 sellerName:string;
 deliveryMethod:string;
 fulfilmentStatus:string;
 payoutStatus:string;
 sellerNetPence:number;
 releaseEligibleAt:string|null;
 fundsReleasedAt:string|null;
 providerTransferId:string|null;
 payoutRollbackRequired:boolean;
 checks:CommerceE2ECheck[];
};

export type CommerceE2EDiagnostic={
 orderId:string;
 orderStatus:string;
 paymentStatus:string;
 totalPence:number;
 currency:string;
 createdAt:string;
 paidAt:string|null;
 stage:string;
 passCount:number;
 pendingCount:number;
 failCount:number;
 checks:CommerceE2ECheck[];
 items:CommerceE2EItem[];
 events:CommerceE2EEvent[];
};

export type CommerceE2EPreflight={
 activeListings:number;
 checkoutReadyListings:number;
 buyerProfiles:number;
 payoutReadySellers:number;
 payoutRecoveryReady:boolean;
 stripeApiMode:CommerceE2EStripeMode;
 stripeWebhookConfigured:boolean;
 siteUrlConfigured:boolean;
 existingOrders:number;
 readyForRealE2E:boolean;
 blockers:string[];
};

const activeCaseStatuses=new Set(["open","seller_response","under_review","return_authorized","return_shipped","returned"]);
const paymentHasSettled=(status:string)=>["paid","partially_refunded","refunded","disputed"].includes(status);
const fulfilmentHasDispatch=(status:string)=>["dispatched","delivered","accepted","completed","return_requested","return_approved","returned","refunded","dispute_open","dispute_resolved"].includes(status);
const fulfilmentHasReceipt=(status:string)=>["delivered","accepted","completed","return_requested","return_approved","returned","refunded","dispute_open","dispute_resolved"].includes(status);

const check=(id:string,label:string,status:CommerceE2ECheckStatus,detail:string,orderItemId?:string):CommerceE2ECheck=>({id,label,status,detail,orderItemId});
const getStripeApiMode=(value:string|undefined):CommerceE2EStripeMode=>{
 const key=(value??"").trim();
 if(!key)return "missing";
 if(key.startsWith("sk_test_")||key.startsWith("rk_test_"))return "test";
 if(key.startsWith("sk_live_")||key.startsWith("rk_live_"))return "live";
 return "unknown";
};
const isSafeHttpsUrl=(value:string|undefined)=>{
 const raw=(value??"").trim();
 if(!raw)return false;
 try{
  const url=new URL(raw);
  return url.protocol==="https:"&&Boolean(url.hostname);
 }catch{
  return false;
 }
};

export async function getCommerceE2EPreflight():Promise<CommerceE2EPreflight>{
 const admin=createSupabaseAdminClient();
 const [listingReadiness,buyers,payoutAccounts,orders,recoveryProbe]=await Promise.all([
  admin.rpc("admin_active_listing_checkout_readiness"),
  admin.from("profiles").select("id",{count:"exact",head:true}).eq("role","buyer"),
  admin.from("seller_payment_accounts").select("seller_id",{count:"exact",head:true}).eq("onboarding_status","complete").eq("transfers_enabled",true).eq("payouts_enabled",true).not("provider_account_id","is",null),
  admin.from("orders").select("id",{count:"exact",head:true}),
  admin.rpc("get_releasing_payout_order_items",{p_limit:1})
 ]);
 if(listingReadiness.error)throw listingReadiness.error;
 if(buyers.error)throw buyers.error;
 if(payoutAccounts.error)throw payoutAccounts.error;
 if(orders.error)throw orders.error;
 const listingRow=listingReadiness.data?.[0];
 const activeListings=Number(listingRow?.active_listings??0);
 const checkoutReadyListings=Number(listingRow?.checkout_ready_listings??0);
 const buyerProfiles=buyers.count??0;
 const payoutReadySellers=payoutAccounts.count??0;
 const payoutRecoveryReady=!recoveryProbe.error;
 const stripeApiMode=getStripeApiMode(process.env.STRIPE_SECRET_KEY);
 const stripeWebhookConfigured=(process.env.STRIPE_WEBHOOK_SECRET??"").trim().startsWith("whsec_");
 const siteUrlConfigured=isSafeHttpsUrl(process.env.NEXT_PUBLIC_SITE_URL??process.env.NEXT_PUBLIC_APP_URL);
 const existingOrders=orders.count??0;
 const blockers:string[]=[];
 if(stripeApiMode==="missing")blockers.push("Stripe API credentials are not configured for the controlled test.");
 if(stripeApiMode==="live")blockers.push("Stripe live credentials are active. Release QA is blocked until this environment uses Stripe test-mode credentials.");
 if(stripeApiMode==="unknown")blockers.push("Stripe API credential mode could not be verified. Release QA requires an sk_test_ or rk_test_ credential.");
 if(!stripeWebhookConfigured)blockers.push("Stripe webhook signing secret is missing or invalid for the controlled test.");
 if(!siteUrlConfigured)blockers.push("Canonical SecondPart site URL is missing or is not a valid HTTPS origin.");
 if(buyerProfiles<1)blockers.push("No buyer account exists for the controlled checkout test.");
 if(activeListings<1)blockers.push("No active listing is available for a buyer checkout.");
 if(payoutReadySellers<1)blockers.push("No seller has completed Stripe Connect payout readiness yet.");
 if(checkoutReadyListings<1)blockers.push("No active listing belongs to a payout-ready seller.");
 if(!payoutRecoveryReady)blockers.push("Payout-transfer recovery RPCs are not available in the release database.");
 return {activeListings,checkoutReadyListings,buyerProfiles,payoutReadySellers,payoutRecoveryReady,stripeApiMode,stripeWebhookConfigured,siteUrlConfigured,existingOrders,readyForRealE2E:blockers.length===0,blockers};
}

export async function getCommerceE2EDiagnostic(orderId:string):Promise<CommerceE2EDiagnostic|null>{
 if(!isUuid(orderId))return null;
 const admin=createSupabaseAdminClient();
 const {data:order,error:orderError}=await admin
  .from("orders")
  .select("id,status,payment_status,total_pence,subtotal_pence,shipping_pence,platform_fee_pence,currency,payment_provider,provider_checkout_session_id,provider_payment_intent_id,provider_charge_id,paid_at,created_at,refunded_pence")
  .eq("id",orderId)
  .maybeSingle();
 if(orderError)throw orderError;
 if(!order)return null;

 const [{data:itemRows,error:itemError},{data:orderEvents,error:eventError},{data:paymentEvents,error:paymentError}]=await Promise.all([
  admin.from("order_items").select("id,part_id,seller_id,quantity,unit_price_pence,shipping_pence,platform_fee_pence,seller_net_pence,delivery_method,fulfilment_status,payout_status,tracking_carrier,tracking_number,dispatched_at,delivered_at,accepted_at,buyer_received_at,release_eligible_at,funds_released_at,provider_transfer_id,payout_rollback_required,provider_transfer_reversal_id,refunded_at,cancelled_at").eq("order_id",orderId).order("id"),
  admin.from("order_events").select("id,order_item_id,event_type,from_status,to_status,created_at").eq("order_id",orderId).order("created_at"),
  admin.from("payment_events").select("id,event_type,provider_event_id,processed_at").eq("order_id",orderId).order("processed_at")
 ]);
 if(itemError)throw itemError;
 if(eventError)throw eventError;
 if(paymentError)throw paymentError;
 const rawItems=itemRows??[];
 const itemIds=rawItems.map(row=>row.id);
 const partIds=[...new Set(rawItems.map(row=>row.part_id))];
 const sellerIds=[...new Set(rawItems.map(row=>row.seller_id))];

 const [partsResult,sellersResult,payoutResult,casesResult]=await Promise.all([
  partIds.length?admin.from("parts").select("id,title").in("id",partIds):Promise.resolve({data:[],error:null}),
  sellerIds.length?admin.from("sellers").select("id,business_name").in("id",sellerIds):Promise.resolve({data:[],error:null}),
  sellerIds.length?admin.from("seller_payment_accounts").select("seller_id,onboarding_status,transfers_enabled,payouts_enabled,provider_account_id").in("seller_id",sellerIds):Promise.resolve({data:[],error:null}),
  itemIds.length?admin.from("transaction_cases").select("id,order_item_id,case_type,status,provider_dispute_id,provider_refund_id,provider_transfer_reversal_id,created_at").in("order_item_id",itemIds).order("created_at"):Promise.resolve({data:[],error:null})
 ]);
 if(partsResult.error)throw partsResult.error;
 if(sellersResult.error)throw sellersResult.error;
 if(payoutResult.error)throw payoutResult.error;
 if(casesResult.error)throw casesResult.error;

 const parts=new Map((partsResult.data??[]).map(row=>[row.id,row.title] as const));
 const sellers=new Map((sellersResult.data??[]).map(row=>[row.id,row.business_name] as const));
 const payoutAccounts=new Map((payoutResult.data??[]).map(row=>[row.seller_id,row] as const));
 const cases=casesResult.data??[];
 const casesByItem=new Map<string,typeof cases>();
 for(const row of cases)casesByItem.set(row.order_item_id,[...(casesByItem.get(row.order_item_id)??[]),row]);

 const orderChecks:CommerceE2ECheck[]=[];
 orderChecks.push(check("order_items","Order contains item snapshot",rawItems.length>0?"pass":"fail",rawItems.length?`${rawItems.length} order item(s) persisted.`:"No order items were persisted."));
 const expectedSubtotal=rawItems.reduce((sum,row)=>sum+row.unit_price_pence*row.quantity,0);
 const expectedShipping=rawItems.reduce((sum,row)=>sum+row.shipping_pence,0);
 const expectedFees=rawItems.reduce((sum,row)=>sum+row.platform_fee_pence,0);
 const amountsMatch=order.subtotal_pence===expectedSubtotal&&order.shipping_pence===expectedShipping&&order.platform_fee_pence===expectedFees&&order.total_pence===expectedSubtotal+expectedShipping;
 orderChecks.push(check("amount_integrity","Order amount snapshot is internally consistent",rawItems.length&&amountsMatch?"pass":"fail",amountsMatch?"Item totals, shipping and platform fees reconcile with the order snapshot.":"Order and item monetary snapshots do not reconcile."));

 const settled=paymentHasSettled(order.payment_status);
 orderChecks.push(check("checkout_session","Stripe Checkout session is recorded",order.provider_checkout_session_id?"pass":settled?"fail":"pending",order.provider_checkout_session_id?"Checkout session ID persisted.":"Waiting for a real Stripe Checkout session."));
 const paymentRefs=Boolean(order.provider_payment_intent_id&&order.provider_charge_id&&order.paid_at);
 orderChecks.push(check("payment_refs","Paid order has provider payment references",settled?(paymentRefs?"pass":"fail"):"pending",settled?(paymentRefs?"PaymentIntent, charge and paid timestamp are persisted.":"Payment is settled but one or more Stripe payment references are missing."):"Order is not paid yet."));
 const paidEvent=(paymentEvents??[]).some(row=>row.event_type==="checkout_paid");
 const paymentConfirmedEvent=(orderEvents??[]).some(row=>row.event_type==="payment_confirmed");
 orderChecks.push(check("payment_event","Webhook/reconciliation payment event is persisted",settled?(paidEvent&&paymentConfirmedEvent?"pass":"fail"):"pending",settled?(paidEvent&&paymentConfirmedEvent?"Both payment event and order audit event exist.":"Paid state is missing its persisted payment/audit event."):"Waiting for Stripe payment confirmation."));

 const items:CommerceE2EItem[]=rawItems.map(row=>{
  const itemChecks:CommerceE2ECheck[]=[];
  const account=payoutAccounts.get(row.seller_id);
  const sellerReady=Boolean(account?.provider_account_id&&account.onboarding_status==="complete"&&account.transfers_enabled&&account.payouts_enabled);
  itemChecks.push(check(`seller-ready-${row.id}`,"Seller is payout-ready",sellerReady?"pass":"fail",sellerReady?"Stripe Connect account is complete with transfers and payouts enabled.":"Seller is not fully payout-ready.",row.id));

  const paidTransitionOk=!settled||row.fulfilment_status!=="pending";
  itemChecks.push(check(`paid-transition-${row.id}`,"Paid item entered fulfilment",paidTransitionOk?(settled?"pass":"pending"):"fail",settled?(paidTransitionOk?`Fulfilment is ${row.fulfilment_status}.`:"Paid order item is still pending."):"Waiting for payment.",row.id));

  if(row.delivery_method==="shipping"){
   const dispatchExpected=fulfilmentHasDispatch(row.fulfilment_status);
   const dispatchEvidence=Boolean(row.dispatched_at&&row.tracking_number&&row.tracking_number.trim().length>=3);
   itemChecks.push(check(`dispatch-${row.id}`,"Shipping dispatch has evidence",dispatchExpected?(dispatchEvidence?"pass":"fail"):"pending",dispatchExpected?(dispatchEvidence?"Dispatch timestamp and shipment reference exist.":"Fulfilment advanced past dispatch without complete dispatch evidence."):"Seller dispatch is still pending.",row.id));
  }else{
   itemChecks.push(check(`collection-${row.id}`,"Collection handoff state",["ready_for_collection","delivered","accepted","completed"].includes(row.fulfilment_status)?"pass":settled?"pending":"pending",`Current collection fulfilment state: ${row.fulfilment_status}.`,row.id));
  }

  const receiptExpected=fulfilmentHasReceipt(row.fulfilment_status);
  const receiptEvidence=Boolean(row.buyer_received_at&&row.delivered_at);
  itemChecks.push(check(`receipt-${row.id}`,"Buyer receipt is auditable",receiptExpected?(receiptEvidence?"pass":"fail"):"pending",receiptExpected?(receiptEvidence?"Buyer received/delivered timestamps are persisted.":"Receipt state exists without required timestamps."):"Buyer receipt has not been confirmed yet.",row.id));

  const payoutScheduled=["scheduled","releasing","released"].includes(row.payout_status);
  itemChecks.push(check(`release-window-${row.id}`,"Payout eligibility has an explicit release time",payoutScheduled?(row.release_eligible_at?"pass":"fail"):"pending",payoutScheduled?(row.release_eligible_at?`Release eligible at ${row.release_eligible_at}.`:"Payout advanced without release_eligible_at."):"Payout is not scheduled yet.",row.id));

  const itemCases=casesByItem.get(row.id)??[];
  const activeCase=itemCases.some(item=>activeCaseStatuses.has(item.status));
  const unsafeRelease=activeCase&&["releasing","released"].includes(row.payout_status);
  itemChecks.push(check(`case-gate-${row.id}`,"Active cases block payout",unsafeRelease?"fail":"pass",activeCase?(unsafeRelease?"An active case exists while payout is releasing/released.":"An active case exists and payout is not being released."):"No active transaction case blocks this item.",row.id));

  itemChecks.push(check(`rollback-${row.id}`,"No unresolved payout rollback exists",row.payout_rollback_required?"fail":"pass",row.payout_rollback_required?"Provider transfer rollback still requires resolution.":"No payout rollback is pending.",row.id));

  const released=row.payout_status==="released";
  const releasedEvidence=Boolean(row.provider_transfer_id&&row.funds_released_at);
  itemChecks.push(check(`transfer-${row.id}`,"Released payout has provider transfer evidence",released?(releasedEvidence?"pass":"fail"):"pending",released?(releasedEvidence?"Stripe transfer ID and release timestamp are persisted.":"Payout says released but provider transfer evidence is incomplete."):"Seller payout has not been released yet.",row.id));

  return {
   id:row.id,
   partId:row.part_id,
   partTitle:parts.get(row.part_id)??"Order item",
   sellerId:row.seller_id,
   sellerName:sellers.get(row.seller_id)??"Seller",
   deliveryMethod:row.delivery_method,
   fulfilmentStatus:row.fulfilment_status,
   payoutStatus:row.payout_status,
   sellerNetPence:row.seller_net_pence,
   releaseEligibleAt:row.release_eligible_at,
   fundsReleasedAt:row.funds_released_at,
   providerTransferId:row.provider_transfer_id,
   payoutRollbackRequired:row.payout_rollback_required,
   checks:itemChecks
  };
 });

 const events:CommerceE2EEvent[]=[
  ...(paymentEvents??[]).map(row=>({id:`payment-${row.id}`,source:"payment" as const,type:row.event_type,createdAt:row.processed_at,orderItemId:null,detail:"Stripe payment event persisted."})),
  ...(orderEvents??[]).map(row=>({id:`order-${row.id}`,source:"order" as const,type:row.event_type,createdAt:row.created_at,orderItemId:row.order_item_id,detail:[row.from_status,row.to_status].filter(Boolean).join(" → ")||"Order audit event."})),
  ...cases.map(row=>({id:`case-${row.id}`,source:"case" as const,type:`${row.case_type}:${row.status}`,createdAt:row.created_at,orderItemId:row.order_item_id,detail:row.provider_dispute_id?"Provider dispute linked to transaction case.":row.provider_refund_id?"Provider refund linked to transaction case.":"Transaction case audit."}))
 ].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));

 const allChecks=[...orderChecks,...items.flatMap(item=>item.checks)];
 const failCount=allChecks.filter(item=>item.status==="fail").length;
 const pendingCount=allChecks.filter(item=>item.status==="pending").length;
 const passCount=allChecks.filter(item=>item.status==="pass").length;
 const allReleased=items.length>0&&items.every(item=>item.payoutStatus==="released"&&item.providerTransferId&&item.fundsReleasedAt);
 const anyActiveCase=cases.some(item=>activeCaseStatuses.has(item.status));
 const anyRefund=order.payment_status==="refunded"||order.payment_status==="partially_refunded";
 const stage=failCount?"integrity_attention":anyActiveCase?"case_or_dispute":anyRefund?"refund_path":allReleased?"completed":settled?items.some(item=>["scheduled","releasing"].includes(item.payoutStatus))?"buyer_protection_or_payout":"fulfilment":"payment";

 return {
  orderId:order.id,
  orderStatus:order.status,
  paymentStatus:order.payment_status,
  totalPence:order.total_pence,
  currency:order.currency,
  createdAt:order.created_at,
  paidAt:order.paid_at,
  stage,
  passCount,
  pendingCount,
  failCount,
  checks:orderChecks,
  items,
  events
 };
}
