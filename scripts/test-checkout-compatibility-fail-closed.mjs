import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const WEB_SOURCE=fs.readFileSync(new URL("../src/app/checkout/actions.ts",import.meta.url),"utf8");
const MOBILE_SOURCE=fs.readFileSync(new URL("../src/app/api/mobile/v1/checkout/route.ts",import.meta.url),"utf8");

const compile=(source)=>ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

class RedirectSignal extends Error{
 constructor(url){super("redirect:"+url);this.url=url;}
}

function webHarness(){
 const calls={rpc:0,stripe:0,reported:[]};
 const exports={};
 const supabase={
  from(table){
   assert.equal(table,"parts");
   return {
    select(){return this;},
    eq(){return this;},
    async maybeSingle(){
     return {data:{slug:"qa-part",seller_id:"seller_test"},error:null};
    }
   };
  },
  async rpc(name){
   calls.rpc++;
   assert.equal(name,"prepare_checkout_order_v2");
   return {data:[{
    order_id:"11111111-1111-4111-8111-111111111111",
    order_item_id:"22222222-2222-4222-8222-222222222222",
    part_title:"QA Part",
    seller_name:"QA Seller",
    quantity:1,
    unit_price_pence:1000,
    shipping_pence:0,
    platform_fee_pence:0,
    seller_net_pence:1000,
    total_pence:1000,
    checkout_expires_at:"2026-09-18T15:00:00Z"
   }],error:null};
  }
 };

 vm.runInNewContext(compile(WEB_SOURCE),{
  exports,
  console,
  URL,
  process:{env:{}},
  FormData,
  require(name){
   if(name==="next/headers")return {
    async headers(){return new Headers({host:"secondpart.test","x-forwarded-proto":"https"});}
   };
   if(name==="next/navigation")return {
    redirect(url){throw new RedirectSignal(url);}
   };
   if(name==="@/lib/auth")return {
    async requireUser(){return {id:"buyer_test",email:"buyer@example.test"};}
   };
   if(name==="@/lib/checkout-lifecycle")return {
    async attachCheckoutSession(){return "https://checkout.stripe.test/session";},
    async cancelCheckoutOrder(){return "cancelled";}
   };
   if(name==="@/lib/checkout-return-origin")return {
    resolveCheckoutReturnOrigin(){return "https://secondpart.test";}
   };
   if(name==="@/lib/supabase/server")return {
    async createSupabaseServerClient(){return supabase;}
   };
   if(name==="@/lib/stripe-payments")return {
    isStripeCheckoutConfigured(){return true;},
    getCreatedCheckoutSessionId(){return null;},
    async createCheckoutSession(){
     calls.stripe++;
     return {id:"cs_test",url:"https://checkout.stripe.test/session"};
    }
   };
   if(name==="@/lib/identifiers")return {
    isUuid(value){return /^[0-9a-f-]{36}$/i.test(value);}
   };
   if(name==="@/lib/data/compatibility")return {
    async getPartCompatibility(){throw new Error("compatibility backend unavailable");}
   };
   if(name==="@/lib/seller-payment-sync")return {
    async syncSellerPaymentAccount(){return {active:true,status:"active"};}
   };
   if(name==="@/lib/stripe-connect")return {
    getAppUrl(){return "https://secondpart.test";}
   };
   if(name==="@/lib/ops-monitoring")return {
    async reportOperationalError(payload){calls.reported.push(payload);}
   };
   throw new Error("Unexpected dependency: "+name);
  }
 });
 return {api:exports,calls};
}

function mobileHarness(){
 const calls={rpc:0,stripe:0,reported:[]};
 const exports={};
 const supabase={
  from(table){
   assert.equal(table,"parts");
   return {
    select(){return this;},
    eq(){return this;},
    async maybeSingle(){
     return {data:{slug:"qa-part",seller_id:"seller_test"},error:null};
    }
   };
  },
  async rpc(name){
   calls.rpc++;
   assert.equal(name,"prepare_checkout_order_v2");
   return {data:[{
    order_id:"11111111-1111-4111-8111-111111111111",
    order_item_id:"22222222-2222-4222-8222-222222222222",
    part_title:"QA Part",
    seller_name:"QA Seller",
    quantity:1,
    unit_price_pence:1000,
    shipping_pence:0,
    platform_fee_pence:0,
    seller_net_pence:1000,
    total_pence:1000,
    checkout_expires_at:"2026-09-18T15:00:00Z"
   }],error:null};
  }
 };

 vm.runInNewContext(compile(MOBILE_SOURCE),{
  exports,
  console,
  URL,
  Request,
  Response,
  process:{env:{}},
  require(name){
   if(name==="@/lib/stripe-payments")return {
    isStripeCheckoutConfigured(){return true;},
    getCreatedCheckoutSessionId(){return null;},
    async createCheckoutSession(){
     calls.stripe++;
     return {id:"cs_test",url:"https://checkout.stripe.test/session"};
    }
   };
   if(name==="@/lib/stripe-connect")return {
    getAppUrl(){return "https://secondpart.test";}
   };
   if(name==="@/lib/checkout-lifecycle")return {
    async attachCheckoutSession(){return "https://checkout.stripe.test/session";},
    async cancelCheckoutOrder(){return "cancelled";}
   };
   if(name==="@/lib/identifiers")return {
    isUuid(value){return /^[0-9a-f-]{36}$/i.test(value);}
   };
   if(name==="@/lib/mobile-api")return {
    mobileOptions(){return new Response(null,{status:204});},
    mobileJson(_request,payload,status=200){
     return new Response(JSON.stringify(payload),{
      status,
      headers:{"content-type":"application/json"}
     });
    },
    async requireMobileUser(){
     return {context:{user:{id:"buyer_test",email:"buyer@example.test"},supabase}};
    }
   };
   if(name==="@/lib/data/compatibility")return {
    async getPartCompatibility(){throw new Error("compatibility backend unavailable");}
   };
   if(name==="@/lib/seller-payment-sync")return {
    async syncSellerPaymentAccount(){return {active:true,status:"active"};}
   };
   if(name==="@/lib/ops-monitoring")return {
    async reportOperationalError(payload){calls.reported.push(payload);}
   };
   throw new Error("Unexpected dependency: "+name);
  }
 });
 return {api:exports,calls};
}

test("web checkout fails closed when selected-vehicle compatibility cannot be verified",async()=>{
 const {api,calls}=webHarness();
 const form=new FormData();
 form.set("partId","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
 form.set("quantity","1");
 form.set("deliveryMethod","shipping");
 form.set("vehicleVariantId","bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
 form.set("vehicleYear","2020");

 const result=await api.startCheckout({},form);

 assert.equal(result.status,"error");
 assert.match(result.message,/could not verify compatibility/i);
 assert.equal(calls.rpc,0,"Compatibility failure must stop before stock reservation.");
 assert.equal(calls.stripe,0,"Compatibility failure must stop before Stripe session creation.");
 assert.equal(calls.reported.length,1);
 assert.equal(calls.reported[0].component,"checkout");
 assert.equal(calls.reported[0].event,"checkout_compatibility_check_failed");
});

test("mobile checkout fails closed when selected-vehicle compatibility cannot be verified",async()=>{
 const {api,calls}=mobileHarness();
 const request=new Request("https://secondpart.test/api/mobile/v1/checkout",{
  method:"POST",
  headers:{"content-type":"application/json"},
  body:JSON.stringify({
   partId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
   quantity:1,
   deliveryMethod:"shipping",
   vehicle:{variantId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",year:2020}
  })
 });
 const response=await api.POST(request);
 const body=await response.json();

 assert.equal(response.status,503);
 assert.deepEqual(body,{ok:false,error:"compatibility_check_unavailable"});
 assert.equal(calls.rpc,0,"Compatibility failure must stop before stock reservation.");
 assert.equal(calls.stripe,0,"Compatibility failure must stop before Stripe session creation.");
 assert.equal(calls.reported.length,1);
 assert.equal(calls.reported[0].component,"checkout");
 assert.equal(calls.reported[0].event,"mobile_checkout_compatibility_check_failed");
});
