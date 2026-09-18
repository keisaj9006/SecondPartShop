import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const LIST_SOURCE=fs.readFileSync(new URL("../src/app/api/mobile/v1/orders/route.ts",import.meta.url),"utf8");
const DETAIL_SOURCE=fs.readFileSync(new URL("../src/app/api/mobile/v1/orders/[orderId]/route.ts",import.meta.url),"utf8");
const compile=(source)=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

const soldItem={
 id:"item-owned",
 part_id:"part-sold",
 quantity:1,
 unit_price_pence:1250,
 shipping_pence:0,
 delivery_method:"shipping",
 fulfilment_status:"preparing",
 payout_status:"not_ready",
 tracking_carrier:null,
 tracking_number:null,
 buyer_received_at:null,
 release_eligible_at:null,
 funds_released_at:null,
 parts:null,
 sellers:{business_name:"QA Seller",slug:"qa-seller"}
};
const order={
 id:"11111111-1111-4111-8111-111111111111",
 status:"paid",
 payment_status:"paid",
 total_pence:1250,
 currency:"GBP",
 created_at:"2026-09-18T10:00:00Z",
 order_items:[soldItem]
};

const makeQuery=({detail=false,missing=false}={})=>({
 select(){return this;},
 eq(){return this;},
 order(){return this;},
 async range(){return {data:missing?[]:[order],error:null};},
 async maybeSingle(){return {data:missing?null:order,error:null};}
});

function harness(source,{detail=false,missing=false}={}){
 const calls={privileged:[]};
 const exports={};
 const query=makeQuery({detail,missing});
 const supabase={
  from(table){
   if(table==="orders")return query;
   if(table==="order_events")return {
    select(){return this;},
    eq(){return this;},
    order(){return Promise.resolve({data:[],error:null});}
   };
   throw new Error("Unexpected user table "+table);
  }
 };
 const admin={
  from(table){
   assert.equal(table,"parts");
   return {
    select(fields){
     assert.equal(fields,"id,title,slug");
     return {
      async in(column,ids){
       assert.equal(column,"id");
       calls.privileged.push(...ids);
       return {
        data:ids.includes("part-sold")
         ?[{id:"part-sold",title:"QA sold part",slug:"qa-sold-part"}]
         :[],
        error:null
       };
      }
     };
    }
   };
  }
 };
 vm.runInNewContext(compile(source),{
  exports,
  console,
  URL,
  Request,
  Response,
  process:{env:{}},
  require(name){
   if(name==="@/lib/identifiers")return {isUuid(){return true;}};
   if(name==="@/lib/mobile-api")return {
    mobileOptions(){return new Response(null,{status:204});},
    mobileJson(_request,payload,status=200){
     return new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json"}});
    },
    async requireMobileUser(){return {context:{user:{id:"buyer-owner"},supabase}};}
   };
   if(name==="@/lib/supabase/admin")return {createSupabaseAdminClient(){return admin;}};
   throw new Error("Unexpected dependency "+name);
  }
 });
 return {api:exports,calls};
}

test("mobile orders list retains an authorized sold item hidden by public parts RLS",async()=>{
 const {api,calls}=harness(LIST_SOURCE);
 const response=await api.GET(new Request("https://secondpart.test/api/mobile/v1/orders"));
 const body=await response.json();

 assert.equal(response.status,200);
 assert.equal(body.items.length,1);
 assert.equal(body.items[0].items.length,1);
 assert.equal(body.items[0].items[0].id,"item-owned");
 assert.equal(body.items[0].items[0].partTitle,"QA sold part");
 assert.equal(body.items[0].items[0].partSlug,"qa-sold-part");
 assert.deepEqual(calls.privileged,["part-sold"]);
});

test("mobile order detail retains an authorized sold item hidden by public parts RLS",async()=>{
 const {api,calls}=harness(DETAIL_SOURCE,{detail:true});
 const response=await api.GET(
  new Request("https://secondpart.test/api/mobile/v1/orders/11111111-1111-4111-8111-111111111111"),
  {params:Promise.resolve({orderId:"11111111-1111-4111-8111-111111111111"})}
 );
 const body=await response.json();

 assert.equal(response.status,200);
 assert.equal(body.order.items.length,1);
 assert.equal(body.order.items[0].id,"item-owned");
 assert.equal(body.order.items[0].partTitle,"QA sold part");
 assert.equal(body.order.items[0].partSlug,"qa-sold-part");
 assert.deepEqual(calls.privileged,["part-sold"]);
});

test("mobile order detail never performs privileged part lookup for an inaccessible order",async()=>{
 const {api,calls}=harness(DETAIL_SOURCE,{detail:true,missing:true});
 const response=await api.GET(
  new Request("https://secondpart.test/api/mobile/v1/orders/11111111-1111-4111-8111-111111111111"),
  {params:Promise.resolve({orderId:"11111111-1111-4111-8111-111111111111"})}
 );
 assert.equal(response.status,404);
 assert.deepEqual(calls.privileged,[]);
});
