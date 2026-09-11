import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compiled=ts.transpileModule(fs.readFileSync(new URL("../src/lib/data/orders.ts",import.meta.url),"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const item={id:"item-owned",part_id:"part-sold",quantity:1,unit_price_pence:1250,shipping_pence:0,delivery_method:"shipping",fulfilment_status:"preparing",payout_status:"not_ready",parts:null,sellers:{business_name:"QA Seller",slug:"qa-seller"}};
const order={id:"order-owned",status:"paid",payment_status:"paid",total_pence:1250,currency:"GBP",created_at:"2026-09-11T19:58:00Z",order_items:[item]};

function adapter(data){
 const filters=[];
 const privileged=[];
 const query={
  select(){return this;},eq(key,value){filters.push([key,value]);return this;},order(){return this;},
  maybeSingle:async()=>({data,error:null}),range:async()=>({data:data?[data]:[],error:null})
 };
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="server-only")return {};
   if(name==="@/lib/supabase/server")return {createSupabaseServerClient:async()=>({from:()=>query})};
   if(name==="@/lib/supabase/admin")return {createSupabaseAdminClient:()=>({from(table){
    assert.equal(table,"parts");
    return {select(fields){assert.equal(fields,"id,title,slug");return {in:async(column,ids)=>{
     assert.equal(column,"id");privileged.push(...ids);
     return {data:ids.includes("part-sold")?[{id:"part-sold",title:"QA sold part",slug:"qa-sold-part"}]:[],error:null};
    }}}};
   }})};
   throw new Error(`Unexpected dependency: ${name}`);
  }
 });
 return {api:exports,filters,privileged};
}

for(const method of ["getBuyerOrderById","getBuyerOrdersPage"]){
 test(`${method} keeps an authorized sold item and its protection controls data`,async()=>{
  const {api,filters,privileged}=adapter(order);
  const result=await api[method]("buyer-owner","order-owned");
  const actual=method==="getBuyerOrderById"?result:result.items[0];
  assert.equal(actual.items.length,1);
  assert.equal(actual.items[0].id,"item-owned");
  assert.equal(actual.items[0].partTitle,"QA sold part");
  assert.equal(actual.items[0].fulfilmentStatus,"preparing");
  assert.deepEqual(privileged,["part-sold"]);
  assert.ok(filters.some(([key,value])=>key==="buyer_id"&&value==="buyer-owner"));
 });
 test(`${method} never performs privileged lookup for an inaccessible order`,async()=>{
  const {api,privileged}=adapter(null);
  const result=await api[method]("another-buyer","order-owned");
  assert.equal(method==="getBuyerOrderById"?result:result.items.length,method==="getBuyerOrderById"?null:0);
  assert.deepEqual(privileged,[]);
 });
}
