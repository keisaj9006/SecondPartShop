import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const sourcePath=new URL("../src/lib/data/transaction-cases.ts",import.meta.url);
const compiled=ts.transpileModule(fs.readFileSync(sourcePath,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function load({caseRows=[],partRows=[],caseError=null,partError=null}={}){
 const calls={caseSelect:"",partIds:[],filters:[],adminCreates:0,range:null};
 const exports={};
 const caseQuery={
  select(value){calls.caseSelect=value;return this;},
  order(){return this;},
  eq(column,value){calls.filters.push([column,value]);return this;},
  range(from,to){calls.range=[from,to];return Promise.resolve({data:caseRows,error:caseError});}
 };
 vm.runInNewContext(compiled,{
  exports,
  console,
  Map,
  Set,
  Promise,
  require(name){
   if(name==="server-only")return {};
   if(name==="@/lib/supabase/server")return {async createSupabaseServerClient(){return {from(){return caseQuery;}};}};
   if(name==="@/lib/supabase/admin")return {createSupabaseAdminClient(){calls.adminCreates++;return {from(){return {select(){return this;},async in(_column,ids){calls.partIds=ids;return {data:partRows,error:partError};}};}};}};
   throw new Error("Unexpected dependency "+name);
  }
 });
 return {module:exports,calls};
}

test("buyer transaction cases retain sold-listing labels without joining through public part RLS",async()=>{
 const caseRows=[{
  id:"case_test",
  order_item_id:"item_test",
  case_type:"return",
  reason:"Item not as described",
  details:"Synthetic QA return details.",
  status:"return_authorized",
  previous_fulfilment_status:"accepted",
  seller_response:"Return acknowledged.",
  resolution:null,
  resolution_notes:null,
  return_tracking_carrier:null,
  return_tracking_number:null,
  return_authorized_at:"2026-11-07T10:00:00Z",
  return_shipped_at:null,
  return_received_at:null,
  provider_dispute_id:null,
  provider_dispute_status:null,
  provider_dispute_reason:null,
  created_at:"2026-11-07T09:00:00Z",
  resolved_at:null,
  order_items:{
   part_id:"part_sold",
   seller_id:"seller_test",
   sellers:{business_name:"QA Seller",slug:"qa-seller"},
   orders:{buyer_id:"buyer_test"}
  }
 }];
 const {module,calls}=load({caseRows,partRows:[{id:"part_sold",title:"Sold QA part",slug:"sold-qa-part"}]});
 const result=await module.getBuyerTransactionCasesPage("buyer_test",{limit:20});
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].partTitle,"Sold QA part");
 assert.equal(result.items[0].partSlug,"sold-qa-part");
 assert.equal([...calls.partIds].join(","),"part_sold");
 assert.doesNotMatch(calls.caseSelect,/parts\(/);
 assert.match(calls.caseSelect,/part_id/);
 assert.equal(JSON.stringify(calls.filters),JSON.stringify([["order_items.orders.buyer_id","buyer_test"]]));
});

test("seller query keeps ownership filter and never hydrates arbitrary caller-supplied IDs",async()=>{
 const {module,calls}=load();
 const result=await module.getSellerTransactionCasesPage("seller_owned",{offset:2,limit:4});
 assert.equal(result.items.length,0);
 assert.equal(JSON.stringify(calls.filters),JSON.stringify([["order_items.seller_id","seller_owned"]]));
 assert.equal(JSON.stringify(calls.range),"[2,6]");
 assert.equal(calls.adminCreates,0);
});

test("case query failure denies hydration instead of returning a misleading empty list",async()=>{
 const {module,calls}=load({caseError:{message:"synthetic database failure"}});
 await assert.rejects(module.getBuyerTransactionCasesPage("buyer_test"),/temporarily unavailable/);
 assert.equal(calls.adminCreates,0);
});

test("listing hydration failure is explicit rather than hiding an authorised case",async()=>{
 const {module}=load({caseRows:[{order_items:{part_id:"part_sold"}}],partError:{message:"synthetic failure"}});
 await assert.rejects(module.getBuyerTransactionCasesPage("buyer_test"),/listings are temporarily unavailable/);
});
