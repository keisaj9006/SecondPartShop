import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source=fs.readFileSync(new URL("../src/app/api/mobile/v1/seller/payments/refresh/route.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function harness({
 paymentRow={provider_account_id:"acct_test",onboarding_status:"complete"},
 transferStatus="active",
 syncResult={active:true,status:"active"},
 syncError=null,
 configured=true
}={}){
 const calls={sync:0,provider:0,adminUpdates:[]};
 const supabase={
  from(table){
   assert.equal(table,"seller_payment_accounts");
   return {
    select(){return this;},
    eq(){return this;},
    async maybeSingle(){return {data:paymentRow,error:null};}
   };
  }
 };
 const admin={
  from(table){
   assert.equal(table,"seller_payment_accounts");
   return {
    update(payload){
     calls.adminUpdates.push(payload);
     return {async eq(){return {error:null};}};
    }
   };
  }
 };
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  Response,
  console,
  process:{env:{}},
  require(name){
   if(name==="@/lib/mobile-api")return {
    mobileJson(_request,payload,status=200){
     return new Response(JSON.stringify(payload),{
      status,
      headers:{"content-type":"application/json"}
     });
    },
    mobileOptions(){return new Response(null,{status:204});},
    async requireMobileSeller(){
     return {context:{supabase},seller:{id:"seller_test"}};
    }
   };
   if(name==="@/lib/supabase/admin")return {
    createSupabaseAdminClient(){return admin;}
   };
   if(name==="@/lib/stripe-connect")return {
    isStripeConnectConfigured(){return configured;},
    async getStripeRecipientAccount(){
     calls.provider++;
     return {id:"acct_test"};
    },
    recipientTransferStatus(){return transferStatus;}
   };
   if(name==="@/lib/seller-payment-sync")return {
    async syncSellerPaymentAccount(sellerId){
     calls.sync++;
     assert.equal(sellerId,"seller_test");
     if(syncError)throw syncError;
     return syncResult;
    }
   };
   throw new Error("Unexpected dependency: "+name);
  }
 });
 return {api:exports,calls};
}

async function json(response){
 return {
  status:response.status,
  body:await response.json()
 };
}

test("mobile payment refresh delegates Stripe/DB readiness synchronization to the shared synchronizer",async()=>{
 const {api,calls}=harness({
  paymentRow:{provider_account_id:"acct_test",onboarding_status:"complete"},
  transferStatus:"active",
  syncResult:{active:true,status:"active"}
 });
 const result=await json(await api.POST(new Request("https://secondpart.test/api/mobile/v1/seller/payments/refresh",{method:"POST"})));

 assert.equal(result.status,200);
 assert.deepEqual(result.body,{ok:true,complete:true,status:"complete",transferStatus:"active"});
 assert.equal(calls.sync,1);
 assert.equal(calls.provider,0,"Route must not call Stripe directly once shared synchronization owns that boundary.");
 assert.equal(calls.adminUpdates.length,0,"Route must not mutate seller_payment_accounts directly.");
});

test("restricted shared status stays restricted in the mobile response",async()=>{
 const {api}=harness({
  paymentRow:{provider_account_id:"acct_test",onboarding_status:"complete"},
  transferStatus:"restricted",
  syncResult:{active:false,status:"restricted"}
 });
 const result=await json(await api.POST(new Request("https://secondpart.test/api/mobile/v1/seller/payments/refresh",{method:"POST"})));

 assert.equal(result.status,200);
 assert.deepEqual(result.body,{ok:true,complete:false,status:"restricted",transferStatus:"restricted"});
});

test("not-connected seller keeps the existing not_started response",async()=>{
 const {api}=harness({
  paymentRow:null,
  syncResult:{active:false,status:"not_connected"}
 });
 const result=await json(await api.POST(new Request("https://secondpart.test/api/mobile/v1/seller/payments/refresh",{method:"POST"})));

 assert.equal(result.status,200);
 assert.deepEqual(result.body,{ok:true,complete:false,status:"not_started"});
});

test("shared synchronization failure remains a controlled 503",async()=>{
 const {api}=harness({
  syncError:new Error("provider unavailable")
 });
 const result=await json(await api.POST(new Request("https://secondpart.test/api/mobile/v1/seller/payments/refresh",{method:"POST"})));

 assert.equal(result.status,503);
 assert.deepEqual(result.body,{ok:false,error:"stripe_status_refresh_failed"});
});
