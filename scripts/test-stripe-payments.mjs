import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as crypto from "node:crypto";

const compiled=ts.transpileModule(fs.readFileSync(new URL("../src/lib/stripe-payments.ts",import.meta.url),"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
function adapter(fetch,env={}){
 const exports={};
 vm.runInNewContext(compiled,{
  exports,Headers,URL,URLSearchParams,Buffer,fetch,
  process:{env:{STRIPE_SECRET_KEY:"sk_test_unit_fixture",...env}},
  require(name){
   if(name==="server-only")return {};
   if(name==="node:crypto")return crypto;
   if(name==="@/lib/stripe-connect")return {getAppUrl:()=>"https://preview.example.test"};
   throw new Error(`Unexpected dependency: ${name}`);
  }
 });
 return exports;
}
const input={orderId:"qa-order",partTitle:"QA TEST PART",partSlug:"qa-part",quantity:1,unitPricePence:1250,shippingPence:0,deliveryMethod:"shipping",expiresAt:"2026-09-12T12:00:00Z"};

test("checkout uses the provider-supported stable API version and preserves payment linkage",async()=>{
 let requests=0;
 const api=adapter(async(url,init)=>{
  requests++;
  assert.equal(url,"https://api.stripe.com/v1/checkout/sessions");
  assert.equal(init.headers.get("Stripe-Version"),"2026-08-26.dahlia");
  assert.equal(init.headers.get("Idempotency-Key"),"secondpart-checkout-qa-order");
  assert.equal(init.method,"POST");
  const body=init.body;
  assert.equal(body.get("line_items[0][price_data][unit_amount]"),"1250");
  assert.equal(body.get("line_items[0][price_data][currency]"),"gbp");
  assert.equal(body.get("metadata[order_id]"),"qa-order");
  assert.equal(body.get("payment_intent_data[metadata][order_id]"),"qa-order");
  assert.equal(body.get("payment_intent_data[transfer_group]"),"order_qa-order");
  assert.equal(body.get("shipping_address_collection[allowed_countries][0]"),"GB");
  return {ok:true,json:async()=>({id:"cs_test_unit",url:"https://checkout.stripe.com/test-unit",livemode:false})};
 });
 const session=await api.createCheckoutSession(input);
 assert.equal(session.id,"cs_test_unit");
 assert.equal(requests,1);
});

test("explicit API version override remains respected",async()=>{
 const api=adapter(async(_url,init)=>{
  assert.equal(init.headers.get("Stripe-Version"),"2026-08-26.preview");
  return {ok:true,json:async()=>({id:"cs_test_unit"})};
 },{STRIPE_API_VERSION:"2026-08-26.preview"});
 await api.getCheckoutSession("cs_test_unit");
});

test("provider failure propagates instead of inventing a successful checkout",async()=>{
 const api=adapter(async()=>({ok:false,json:async()=>({error:{message:"Invalid Stripe API version"}})}));
 await assert.rejects(api.createCheckoutSession(input),/Invalid Stripe API version/);
});

test("session expiration posts with a stable session-specific retry key",async()=>{
 const api=adapter(async(url,init)=>{
  assert.equal(url,"https://api.stripe.com/v1/checkout/sessions/cs_test_unit/expire");
  assert.equal(init.method,"POST");
  assert.equal(init.headers.get("Idempotency-Key"),"secondpart-checkout-expire-cs_test_unit");
  return {ok:true,json:async()=>({id:"cs_test_unit",status:"expired",payment_status:"unpaid"})};
 });
 assert.equal((await api.expireCheckoutSession("cs_test_unit")).status,"expired");
});

test("successful response with unreadable JSON cannot become a confirmed checkout creation",async()=>{
 const api=adapter(async()=>({ok:true,json:async()=>{throw new SyntaxError('unreadable provider body');}}));
 await assert.rejects(api.createCheckoutSession(input),/Checkout Session response/);
});
for(const payload of [{},{id:''},{id:123},null])test("malformed successful creation response is rejected: "+JSON.stringify(payload),async()=>{
 const api=adapter(async()=>({ok:true,json:async()=>payload}));
 await assert.rejects(api.createCheckoutSession(input),/Checkout Session response/);
});
