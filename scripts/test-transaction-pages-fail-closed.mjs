import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compile=(path)=>ts.transpileModule(fs.readFileSync(new URL("../"+path,import.meta.url),"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;

const jsx=(type,props)=>({type,props:props??{}});
const jsxs=jsx;
const Fragment="Fragment";
const component=()=>null;
const link=({children})=>jsx("a",{children});

function load(path,stubs){
 const exports={};
 vm.runInNewContext(compile(path),{
  exports,
  console,
  Intl,
  Date,
  Map,
  Set,
  Promise,
  encodeURIComponent,
  process:{env:{}},
  require(name){
   if(name==="react/jsx-runtime")return {jsx,jsxs,Fragment};
   if(name==="next/link")return {__esModule:true,default:link};
   if(name==="lucide-react")return new Proxy({}, {get:()=>component});
   if(name in stubs)return stubs[name];
   if(name.startsWith("@/components/"))return new Proxy({}, {get:()=>component});
   throw new Error("Unexpected dependency "+name+" in "+path);
  }
 });
 return exports.default;
}

const backendError=new Error("backend unavailable");

test("Purchases does not turn an orders backend failure into an empty purchase history",async()=>{
 const page=load("src/app/account/orders/page.tsx",{
  "@/lib/auth":{async requireUser(){return {id:"buyer_test"};}},
  "@/lib/data/orders":{async getBuyerOrdersPage(){throw backendError;}},
  "@/app/account/orders/checkout-actions":{resumeCheckout(){}}
 });
 await assert.rejects(
  page({searchParams:Promise.resolve({})}),
  /backend unavailable/
 );
});

test("Seller sales does not turn an orders backend failure into No sales yet",async()=>{
 const page=load("src/app/dashboard/orders/page.tsx",{
  "@/lib/auth":{async requireSeller(){return {user:{id:"seller_owner"}};}},
  "@/lib/data/marketplace":{async getSellerForOwner(){return {id:"seller_test"};}},
  "@/lib/data/orders":{async getSellerSalesPage(){throw backendError;}}
 });
 await assert.rejects(
  page({searchParams:Promise.resolve({})}),
  /backend unavailable/
 );
});

test("Buyer cases does not turn a case backend failure into zero cases",async()=>{
 const page=load("src/app/account/cases/page.tsx",{
  "@/lib/auth":{async requireUser(){return {id:"buyer_test"};}},
  "@/lib/data/case-evidence":{async getTransactionCaseEvidence(){return new Map();}},
  "@/lib/data/orders":{async getBuyerOrdersPage(){return {items:[],hasMore:false,offset:0,limit:30};}},
  "@/lib/data/transaction-cases":{
   async getBuyerTransactionCasesPage(){throw backendError;},
   async getBuyerCaseOrderItem(){return null;},
   async getActiveCaseOrderItemIds(){return new Set();}
  }
 });
 await assert.rejects(
  page({searchParams:Promise.resolve({})}),
  /backend unavailable/
 );
});

test("Buyer cases fails closed if active-case lookup is unavailable",async()=>{
 const page=load("src/app/account/cases/page.tsx",{
  "@/lib/auth":{async requireUser(){return {id:"buyer_test"};}},
  "@/lib/data/case-evidence":{async getTransactionCaseEvidence(){return new Map();}},
  "@/lib/data/orders":{
   async getBuyerOrdersPage(){
    return {
     items:[{
      id:"order_test",
      paymentStatus:"paid",
      items:[{
       id:"item_test",
       partTitle:"QA Part",
       sellerName:"QA Seller",
       fulfilmentStatus:"preparing"
      }]
     }],
     hasMore:false,
     offset:0,
     limit:30
    };
   }
  },
  "@/lib/data/transaction-cases":{
   async getBuyerTransactionCasesPage(){return {items:[],hasMore:false,offset:0,limit:20};},
   async getBuyerCaseOrderItem(){return null;},
   async getActiveCaseOrderItemIds(){throw backendError;}
  }
 });
 await assert.rejects(
  page({searchParams:Promise.resolve({})}),
  /backend unavailable/
 );
});

test("Seller cases does not turn a case backend failure into No transaction cases",async()=>{
 const page=load("src/app/dashboard/cases/page.tsx",{
  "@/lib/auth":{async requireSeller(){return {user:{id:"seller_owner"}};}},
  "@/lib/data/marketplace":{async getSellerForOwner(){return {id:"seller_test"};}},
  "@/lib/data/case-evidence":{async getTransactionCaseEvidence(){return new Map();}},
  "@/lib/data/transaction-cases":{async getSellerTransactionCasesPage(){throw backendError;}}
 });
 await assert.rejects(
  page({searchParams:Promise.resolve({})}),
  /backend unavailable/
 );
});

test("Seller cases does not hide evidence backend failure as an empty evidence set",async()=>{
 const page=load("src/app/dashboard/cases/page.tsx",{
  "@/lib/auth":{async requireSeller(){return {user:{id:"seller_owner"}};}},
  "@/lib/data/marketplace":{async getSellerForOwner(){return {id:"seller_test"};}},
  "@/lib/data/case-evidence":{async getTransactionCaseEvidence(){throw backendError;}},
  "@/lib/data/transaction-cases":{async getSellerTransactionCasesPage(){return {items:[],hasMore:false,offset:0,limit:20};}}
 });
 await assert.rejects(
  page({searchParams:Promise.resolve({})}),
  /backend unavailable/
 );
});

function adminHarness({caseFailure=false,payoutFailure=false}={}){
 const calls={reported:[]};
 const page=load("src/app/admin/commerce/page.tsx",{
  "@/lib/auth":{async requireAdmin(){}},
  "@/lib/data/case-evidence":{async getTransactionCaseEvidence(){return new Map();}},
  "@/lib/data/transaction-cases":{
   async getTransactionCasesPage(){
    if(caseFailure)throw backendError;
    return {items:[],hasMore:false,offset:0,limit:30};
   }
  },
  "@/lib/supabase/server":{
   async createSupabaseServerClient(){
    return {
     async rpc(){
      return payoutFailure
       ?{data:null,error:new Error("payout reviews unavailable")}
       :{data:[],error:null};
     }
    };
   }
  },
  "@/lib/ops-monitoring":{
   async reportOperationalError(payload){calls.reported.push(payload);}
  }
 });
 return {page,calls};
}

test("Admin Commerce reports and propagates case-list backend failure",async()=>{
 const {page,calls}=adminHarness({caseFailure:true});
 await assert.rejects(page({searchParams:Promise.resolve({})}),/backend unavailable/);
 assert.equal(calls.reported.length,1);
 assert.equal(calls.reported[0].component,"commerce_admin");
 assert.equal(calls.reported[0].event,"commerce_admin_data_load_failed");
});

test("Admin Commerce reports and propagates payout-review RPC failure",async()=>{
 const {page,calls}=adminHarness({payoutFailure:true});
 await assert.rejects(page({searchParams:Promise.resolve({})}),/payout reviews unavailable/);
 assert.equal(calls.reported.length,1);
 assert.equal(calls.reported[0].component,"commerce_admin");
 assert.equal(calls.reported[0].event,"commerce_admin_data_load_failed");
});
