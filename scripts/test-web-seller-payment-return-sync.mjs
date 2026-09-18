import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source=fs.readFileSync(new URL("../src/app/dashboard/payments/page.tsx",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{
  module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022,
  jsx:ts.JsxEmit.ReactJSX
 }
}).outputText;

const jsx=(type,props)=>({type,props:props??{}});
const jsxs=jsx;
const Fragment="Fragment";

function textFrom(value){
 if(value===null||value===undefined||typeof value==="boolean")return "";
 if(typeof value==="string"||typeof value==="number")return String(value);
 if(Array.isArray(value))return value.map(textFrom).join(" ");
 if(typeof value==="object"){
  if("props" in value)return textFrom(value.props?.children);
  return Object.values(value).map(textFrom).join(" ");
 }
 return "";
}

function harness({syncError=null,syncResult={active:false,status:"pending"}}={}){
 const calls={sync:0,reported:[]};
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  console,
  process:{env:{}},
  require(name){
   if(name==="react/jsx-runtime")return {jsx,jsxs,Fragment};
   if(name==="next/link")return {__esModule:true,default:"Link"};
   if(name==="lucide-react")return {
    Banknote:"Banknote",
    CheckCircle2:"CheckCircle2",
    ExternalLink:"ExternalLink",
    ShieldCheck:"ShieldCheck"
   };
   if(name==="@/components/header")return {Header:"Header"};
   if(name==="@/lib/auth")return {
    async requireSeller(){return {user:{id:"user_test"}};}
   };
   if(name==="@/lib/data/marketplace")return {
    async getSellerForOwner(){return {id:"seller_test",businessName:"QA Seller"};}
   };
   if(name==="@/lib/data/seller-payments")return {
    async getSellerPaymentAccount(){
     return {
      sellerId:"seller_test",
      provider:"stripe",
      onboardingStatus:"pending",
      transfersEnabled:false,
      payoutsEnabled:false,
      detailsSubmitted:false
     };
    }
   };
   if(name==="@/lib/seller-payment-sync")return {
    async syncSellerPaymentAccount(sellerId){
     calls.sync++;
     assert.equal(sellerId,"seller_test");
     if(syncError)throw syncError;
     return syncResult;
    }
   };
   if(name==="@/lib/stripe-connect")return {
    isStripeConnectConfigured(){return true;}
   };
   if(name==="./actions")return {
    refreshStripePaymentStatus(){},
    startStripeOnboarding(){}
   };
   if(name==="@/lib/ops-monitoring")return {
    async reportOperationalError(payload){calls.reported.push(payload);}
   };
   throw new Error("Unexpected dependency: "+name);
  }
 });
 return {page:exports.default,calls};
}

test("Stripe onboarding return sync failure is reported instead of being silently swallowed",async()=>{
 const {page,calls}=harness({syncError:new Error("provider unavailable")});
 await page({searchParams:Promise.resolve({returned:"1"})});

 assert.equal(calls.sync,1);
 assert.equal(calls.reported.length,1);
 assert.equal(calls.reported[0].component,"payout");
 assert.equal(calls.reported[0].event,"seller_stripe_onboarding_return_sync_failed");
});

test("Stripe onboarding return sync failure does not claim the account was re-checked",async()=>{
 const {page}=harness({syncError:new Error("provider unavailable")});
 const tree=await page({searchParams:Promise.resolve({returned:"1"})});
 const text=textFrom(tree);

 assert.match(text,/could not refresh your Stripe status automatically/i);
 assert.doesNotMatch(text,/SecondPart re-checked the account automatically/i);
 assert.match(text,/Refresh status/i);
});

test("successful Stripe onboarding return keeps the existing automatic re-check UX",async()=>{
 const {page,calls}=harness({syncResult:{active:true,status:"active"}});
 const tree=await page({searchParams:Promise.resolve({returned:"1"})});
 const text=textFrom(tree);

 assert.equal(calls.sync,1);
 assert.equal(calls.reported.length,0);
 assert.match(text,/Stripe onboarding is complete/i);
 assert.match(text,/SecondPart re-checked the account automatically/i);
});
