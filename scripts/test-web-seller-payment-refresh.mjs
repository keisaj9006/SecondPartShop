import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source=fs.readFileSync(new URL("../src/app/dashboard/payments/actions.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

class RedirectSignal extends Error{
 constructor(url){super("redirect:"+url);this.url=url;}
}

function harness({syncResult={active:true,status:"active"},syncError=null,providerError=null,configured=true}={}){
 const calls={
  sync:0,
  provider:0,
  adminUpdates:[],
  revalidated:[],
  reported:[]
 };
 const paymentQuery={
  select(){return this;},
  eq(){return this;},
  async maybeSingle(){return {data:{provider_account_id:"acct_test"},error:null};}
 };
 const supabase={
  from(table){
   assert.equal(table,"seller_payment_accounts");
   return paymentQuery;
  }
 };
 const admin={
  from(table){
   assert.equal(table,"seller_payment_accounts");
   return {
    update(payload){
     calls.adminUpdates.push(payload);
     return {async eq(){return {error:null};}};
    },
    upsert(){return Promise.resolve({error:null});}
   };
  }
 };
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  console,
  process:{env:{}},
  require(name){
   if(name==="server-only")return {};
   if(name==="next/navigation")return {
    redirect(url){throw new RedirectSignal(url);}
   };
   if(name==="next/cache")return {
    revalidatePath(path){calls.revalidated.push(path);}
   };
   if(name==="@/lib/auth")return {
    async requireSeller(){return {user:{id:"user_test",email:"seller@example.test"}};}
   };
   if(name==="@/lib/data/marketplace")return {
    async getSellerForOwner(){return {id:"seller_test",businessName:"QA Seller"};}
   };
   if(name==="@/lib/supabase/server")return {
    async createSupabaseServerClient(){return supabase;}
   };
   if(name==="@/lib/supabase/admin")return {
    createSupabaseAdminClient(){return admin;}
   };
   if(name==="@/lib/ops-monitoring")return {
    async reportOperationalError(payload){calls.reported.push(payload);}
   };
   if(name==="@/lib/stripe-connect")return {
    isStripeConnectConfigured(){return configured;},
    async createStripeRecipientAccount(){return {id:"acct_created"};},
    async createStripeOnboardingLink(){return "https://connect.stripe.test/onboarding";},
    async getStripeRecipientAccount(){
     calls.provider++;
     if(providerError)throw providerError;
     return {id:"acct_test"};
    },
    recipientTransferStatus(){return "active";}
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

async function expectRedirect(promise,url){
 await assert.rejects(promise,error=>{
  assert.ok(error instanceof RedirectSignal);
  assert.equal(error.url,url);
  return true;
 });
}

test("web payment status refresh delegates provider/database state to the shared synchronizer",async()=>{
 const {api,calls}=harness({syncResult:{active:true,status:"active"}});
 await expectRedirect(api.refreshStripePaymentStatus(),"/dashboard/payments?refreshed=1");

 assert.equal(calls.sync,1);
 assert.equal(calls.provider,0,"Manual web refresh must not call Stripe directly.");
 assert.equal(calls.adminUpdates.length,0,"Manual web refresh must not write seller_payment_accounts directly.");
 assert.deepEqual(calls.revalidated,["/dashboard/payments"]);
 assert.equal(calls.reported.length,0);
});

test("shared synchronization failure keeps monitoring and the existing controlled error redirect",async()=>{
 const {api,calls}=harness({syncError:new Error("provider unavailable")});
 await expectRedirect(api.refreshStripePaymentStatus(),"/dashboard/payments?error=sync");

 assert.equal(calls.sync,1);
 assert.equal(calls.provider,0);
 assert.equal(calls.adminUpdates.length,0);
 assert.equal(calls.revalidated.length,0);
 assert.equal(calls.reported.length,1);
 assert.equal(calls.reported[0].component,"payout");
 assert.equal(calls.reported[0].event,"seller_stripe_status_sync_failed");
});
