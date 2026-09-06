import "server-only";

import { createHmac,timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/stripe-connect";

const STRIPE_API="https://api.stripe.com";
const STRIPE_V1_VERSION="2026-08-26.clover";

type StripeErrorPayload={error?:{message?:string}};

export type StripeCheckoutSession={
 id:string;
 url:string|null;
 status:string|null;
 payment_status:string;
 payment_intent:string|{id:string}|null;
 client_reference_id:string|null;
 metadata?:Record<string,string>;
 collected_information?:Record<string,unknown>|null;
 shipping_details?:Record<string,unknown>|null;
};

export type StripePaymentIntent={
 id:string;
 status:string;
 latest_charge:string|{id:string}|null;
};

export type StripeTransfer={id:string;amount:number;currency:string;destination:string|{id:string}};
export type StripeRefund={id:string;status:string|null;amount:number};
export type StripeTransferReversal={id:string;amount:number};

const secret=()=>{
 const value=process.env.STRIPE_SECRET_KEY?.trim();
 if(!value)throw new Error("Stripe is not configured.");
 return value;
};

export function isStripeCheckoutConfigured(){
 return Boolean(
  process.env.STRIPE_SECRET_KEY?.trim()&&
  process.env.STRIPE_WEBHOOK_SECRET?.trim()&&
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()&&
  (process.env.NEXT_PUBLIC_APP_URL?.trim()||process.env.NEXT_PUBLIC_SITE_URL?.trim())
 );
}

async function stripeV1<T>(path:string,init:RequestInit={}):Promise<T>{
 const headers=new Headers(init.headers);
 headers.set("Authorization",`Bearer ${secret()}`);
 headers.set("Stripe-Version",process.env.STRIPE_API_VERSION?.trim()||STRIPE_V1_VERSION);
 if(init.body)headers.set("Content-Type","application/x-www-form-urlencoded");
 const response=await fetch(`${STRIPE_API}${path}`,{...init,headers,cache:"no-store"});
 const payload=await response.json().catch(()=>({})) as StripeErrorPayload&T;
 if(!response.ok)throw new Error(payload.error?.message||"Stripe request failed.");
 return payload as T;
}

const append=(body:URLSearchParams,key:string,value:string|number|undefined|null)=>{
 if(value!==undefined&&value!==null)body.append(key,String(value));
};

export async function createCheckoutSession(input:{
 orderId:string;
 partTitle:string;
 partSlug:string;
 quantity:number;
 unitPricePence:number;
 shippingPence:number;
 deliveryMethod:"shipping"|"collection";
 customerEmail?:string|null;
 expiresAt:string;
}){
 const body=new URLSearchParams();
 append(body,"mode","payment");
 append(body,"success_url",`${getAppUrl()}/account/orders?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
 append(body,"cancel_url",`${getAppUrl()}/parts/${encodeURIComponent(input.partSlug)}?checkout=cancelled`);
 append(body,"client_reference_id",input.orderId);
 append(body,"customer_email",input.customerEmail);
 append(body,"metadata[order_id]",input.orderId);
 append(body,"payment_intent_data[transfer_group]",`order_${input.orderId}`);
 append(body,"payment_intent_data[metadata][order_id]",input.orderId);
 append(body,"expires_at",Math.floor(new Date(input.expiresAt).getTime()/1000));
 if(input.deliveryMethod==="shipping"){
  append(body,"shipping_address_collection[allowed_countries][0]","GB");
 }

 append(body,"line_items[0][price_data][currency]","gbp");
 append(body,"line_items[0][price_data][product_data][name]",input.partTitle);
 append(body,"line_items[0][price_data][unit_amount]",input.unitPricePence);
 append(body,"line_items[0][quantity]",input.quantity);

 if(input.shippingPence>0){
  append(body,"line_items[1][price_data][currency]","gbp");
  append(body,"line_items[1][price_data][product_data][name]","Delivery");
  append(body,"line_items[1][price_data][unit_amount]",input.shippingPence);
  append(body,"line_items[1][quantity]",1);
 }

 return stripeV1<StripeCheckoutSession>("/v1/checkout/sessions",{method:"POST",body,headers:{"Idempotency-Key":`secondpart-checkout-${input.orderId}`}});
}

export async function getCheckoutSession(sessionId:string){
 return stripeV1<StripeCheckoutSession>(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{method:"GET"});
}

export async function getPaymentIntent(paymentIntentId:string){
 return stripeV1<StripePaymentIntent>(`/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,{method:"GET"});
}

export async function createSellerTransfer(input:{
 orderId:string;
 orderItemId:string;
 amountPence:number;
 destinationAccountId:string;
 sourceChargeId:string;
}){
 const body=new URLSearchParams();
 append(body,"amount",input.amountPence);
 append(body,"currency","gbp");
 append(body,"destination",input.destinationAccountId);
 append(body,"transfer_group",`order_${input.orderId}`);
 append(body,"source_transaction",input.sourceChargeId);
 append(body,"metadata[order_id]",input.orderId);
 append(body,"metadata[order_item_id]",input.orderItemId);
 return stripeV1<StripeTransfer>("/v1/transfers",{method:"POST",body,headers:{"Idempotency-Key":`secondpart-transfer-${input.orderItemId}`}});
}

export async function reverseSellerTransfer(transferId:string,amountPence?:number,idempotencyKey?:string){
 const body=new URLSearchParams();
 append(body,"amount",amountPence);
 return stripeV1<StripeTransferReversal>(`/v1/transfers/${encodeURIComponent(transferId)}/reversals`,{
  method:"POST",
  body,
  headers:idempotencyKey?{"Idempotency-Key":idempotencyKey}:undefined
 });
}

export async function refundPlatformPayment(input:{paymentIntentId:string;amountPence?:number;idempotencyKey?:string}){
 const body=new URLSearchParams();
 append(body,"payment_intent",input.paymentIntentId);
 append(body,"amount",input.amountPence);
 append(body,"reason","requested_by_customer");
 return stripeV1<StripeRefund>("/v1/refunds",{
  method:"POST",
  body,
  headers:input.idempotencyKey?{"Idempotency-Key":input.idempotencyKey}:undefined
 });
}

export function verifyStripeWebhookSignature(payload:string,header:string|null){
 const secretValue=process.env.STRIPE_WEBHOOK_SECRET?.trim();
 if(!secretValue||!header)return false;
 const fields=header.split(",").map(part=>part.trim());
 const timestamp=fields.find(part=>part.startsWith("t="))?.slice(2);
 const signatures=fields.filter(part=>part.startsWith("v1=")).map(part=>part.slice(3));
 if(!timestamp||!signatures.length)return false;

 const timestampNumber=Number(timestamp);
 if(!Number.isFinite(timestampNumber))return false;
 const toleranceSeconds=300;
 if(Math.abs(Math.floor(Date.now()/1000)-timestampNumber)>toleranceSeconds)return false;

 const expected=createHmac("sha256",secretValue).update(`${timestamp}.${payload}`,"utf8").digest("hex");
 const expectedBuffer=Buffer.from(expected,"hex");

 return signatures.some(signature=>{
  try{
   const candidate=Buffer.from(signature,"hex");
   return candidate.length===expectedBuffer.length&&timingSafeEqual(candidate,expectedBuffer);
  }catch{return false;}
 });
}
