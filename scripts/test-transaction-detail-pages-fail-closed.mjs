import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compile=(path,jsxMode=false)=>ts.transpileModule(fs.readFileSync(new URL("../"+path,import.meta.url),"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:jsxMode?ts.JsxEmit.ReactJSX:undefined}
}).outputText;

const jsx=(type,props)=>({type,props:props??{}});
const jsxs=jsx;
const Fragment="Fragment";
const component=()=>null;
const link=({children})=>jsx("a",{children});

class NotFoundSignal extends Error{
 constructor(){super("not found");}
}

function loadPage(path,stubs){
 const exports={};
 vm.runInNewContext(compile(path,true),{
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
   if(name==="next/navigation")return {notFound(){throw new NotFoundSignal();}};
   if(name==="lucide-react")return new Proxy({}, {get:()=>component});
   if(name in stubs)return stubs[name];
   if(name.startsWith("@/components/"))return new Proxy({}, {get:()=>component});
   throw new Error("Unexpected dependency "+name+" in "+path);
  }
 });
 return exports.default;
}

const backendError=new Error("backend unavailable");

const buyerOrder={
 id:"11111111-1111-4111-8111-111111111111",
 status:"paid",
 paymentStatus:"paid",
 totalPence:1000,
 currency:"GBP",
 createdAt:"2026-09-18T10:00:00Z",
 items:[]
};

test("buyer order detail preserves true not-found but propagates backend failures",async()=>{
 const missingPage=loadPage("src/app/account/orders/[orderId]/page.tsx",{
  "@/lib/auth":{async requireUser(){return {id:"buyer_test"};}},
  "@/lib/data/orders":{
   async getBuyerOrderById(){return null;},
   async getOrderTimeline(){return [];}
  },
  "@/app/account/orders/checkout-actions":{resumeCheckout(){}}
 });
 await assert.rejects(
  missingPage({
   params:Promise.resolve({orderId:buyerOrder.id}),
   searchParams:Promise.resolve({})
  }),
  error=>error instanceof NotFoundSignal
 );

 const failedPage=loadPage("src/app/account/orders/[orderId]/page.tsx",{
  "@/lib/auth":{async requireUser(){return {id:"buyer_test"};}},
  "@/lib/data/orders":{
   async getBuyerOrderById(){throw backendError;},
   async getOrderTimeline(){return [];}
  },
  "@/app/account/orders/checkout-actions":{resumeCheckout(){}}
 });
 await assert.rejects(
  failedPage({
   params:Promise.resolve({orderId:buyerOrder.id}),
   searchParams:Promise.resolve({})
  }),
  /backend unavailable/
 );
});

test("buyer order detail does not hide timeline backend failure as an empty history",async()=>{
 const page=loadPage("src/app/account/orders/[orderId]/page.tsx",{
  "@/lib/auth":{async requireUser(){return {id:"buyer_test"};}},
  "@/lib/data/orders":{
   async getBuyerOrderById(){return buyerOrder;},
   async getOrderTimeline(){throw backendError;}
  },
  "@/app/account/orders/checkout-actions":{resumeCheckout(){}}
 });
 await assert.rejects(
  page({
   params:Promise.resolve({orderId:buyerOrder.id}),
   searchParams:Promise.resolve({})
  }),
  /backend unavailable/
 );
});

const sellerSale={
 orderItemId:"22222222-2222-4222-8222-222222222222",
 orderId:"11111111-1111-4111-8111-111111111111",
 partTitle:"QA Part",
 partSlug:"qa-part",
 quantity:1,
 unitPricePence:1000,
 shippingPence:0,
 platformFeePence:0,
 sellerNetPence:1000,
 deliveryMethod:"shipping",
 fulfilmentStatus:"preparing",
 payoutStatus:"not_ready",
 trackingCarrier:null,
 trackingNumber:null,
 releaseEligibleAt:null,
 fundsReleasedAt:null,
 orderStatus:"paid",
 paymentStatus:"paid",
 orderCreatedAt:"2026-09-18T10:00:00Z",
 shippingName:null,
 shippingAddress:null
};

test("seller sale detail preserves true not-found but propagates backend failures",async()=>{
 const base={
  "@/lib/auth":{async requireSeller(){return {user:{id:"seller_owner"}};}},
  "@/lib/data/marketplace":{async getSellerForOwner(){return {id:"seller_test"};}}
 };

 const missingPage=loadPage("src/app/dashboard/orders/[orderItemId]/page.tsx",{
  ...base,
  "@/lib/data/orders":{
   async getSellerSaleById(){return null;},
   async getOrderTimeline(){return [];}
  }
 });
 await assert.rejects(
  missingPage({params:Promise.resolve({orderItemId:sellerSale.orderItemId})}),
  error=>error instanceof NotFoundSignal
 );

 const failedPage=loadPage("src/app/dashboard/orders/[orderItemId]/page.tsx",{
  ...base,
  "@/lib/data/orders":{
   async getSellerSaleById(){throw backendError;},
   async getOrderTimeline(){return [];}
  }
 });
 await assert.rejects(
  failedPage({params:Promise.resolve({orderItemId:sellerSale.orderItemId})}),
  /backend unavailable/
 );
});

test("seller sale detail does not hide timeline backend failure as an empty history",async()=>{
 const page=loadPage("src/app/dashboard/orders/[orderItemId]/page.tsx",{
  "@/lib/auth":{async requireSeller(){return {user:{id:"seller_owner"}};}},
  "@/lib/data/marketplace":{async getSellerForOwner(){return {id:"seller_test"};}},
  "@/lib/data/orders":{
   async getSellerSaleById(){return sellerSale;},
   async getOrderTimeline(){throw backendError;}
  }
 });
 await assert.rejects(
  page({params:Promise.resolve({orderItemId:sellerSale.orderItemId})}),
  /backend unavailable/
 );
});

test("Buyer Cases selected purchase lookup failure is not silently treated as no selection",async()=>{
 const page=loadPage("src/app/account/cases/page.tsx",{
  "@/lib/auth":{async requireUser(){return {id:"buyer_test"};}},
  "@/lib/data/case-evidence":{async getTransactionCaseEvidence(){return new Map();}},
  "@/lib/data/orders":{async getBuyerOrdersPage(){return {items:[],hasMore:false,offset:0,limit:30};}},
  "@/lib/data/transaction-cases":{
   async getBuyerTransactionCasesPage(){return {items:[],hasMore:false,offset:0,limit:20};},
   async getBuyerCaseOrderItem(){throw backendError;},
   async getActiveCaseOrderItemIds(){return new Set();}
  }
 });
 await assert.rejects(
  page({searchParams:Promise.resolve({item:"22222222-2222-4222-8222-222222222222"})}),
  /backend unavailable/
 );
});

test("getBuyerCaseOrderItem distinguishes Supabase failure from a genuine missing purchase",async()=>{
 const exports={};
 const query={
  select(){return this;},
  eq(){return this;},
  async maybeSingle(){return {data:null,error:backendError};}
 };
 vm.runInNewContext(compile("src/lib/data/transaction-cases.ts"),{
  exports,
  console,
  process:{env:{}},
  require(name){
   if(name==="server-only")return {};
   if(name==="@/lib/supabase/server")return {
    async createSupabaseServerClient(){return {from(){return query;}};}
   };
   throw new Error("Unexpected dependency "+name);
  }
 });

 await assert.rejects(
  exports.getBuyerCaseOrderItem("buyer_test","22222222-2222-4222-8222-222222222222"),
  /temporarily unavailable/i
 );
});
