import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const caseId="00000000-0000-4000-8000-000000000141";
const orderItemId="00000000-0000-4000-8000-000000000142";
const orderId="00000000-0000-4000-8000-000000000143";

function fixture(refundOverrides={}){
 const state={
  caseRow:{id:caseId,order_item_id:orderItemId,status:"open",provider_refund_id:null,provider_dispute_id:null},
  item:{
   id:orderItemId,
   order_id:orderId,
   quantity:1,
   unit_price_pence:2500,
   shipping_pence:500,
   seller_net_pence:2200,
   payout_status:"blocked",
   funds_released_at:null,
   provider_transfer_id:null,
   provider_transfer_reversal_id:null
  },
  order:{id:orderId,provider_payment_intent_id:"pi_fixture",payment_status:"paid"},
  refund:{
   id:"re_fixture",
   status:"succeeded",
   amount:3000,
   currency:"gbp",
   payment_intent:"pi_fixture",
   ...refundOverrides
  },
  refundCreateCalls:0,
  refundReadCalls:0,
  finalizeCalls:0
 };

 const db={
  from(table){
   const filters=[];
   const nullFilters=[];
   let updateValue=null;
   const query={
    select(){return query;},
    eq(key,value){filters.push([key,value]);return query;},
    is(key,value){nullFilters.push([key,value]);return query;},
    update(value){updateValue=value;return query;},
    async maybeSingle(){return run();},
    then(resolve,reject){return Promise.resolve(run()).then(resolve,reject);}
   };
   function row(){
    if(table==="transaction_cases")return state.caseRow;
    if(table==="order_items")return state.item;
    if(table==="orders")return state.order;
    return null;
   }
   function run(){
    const current=row();
    if(!current)return {data:null,error:null};
    const matches=filters.every(([key,value])=>current[key]===value)
     &&nullFilters.every(([key,value])=>value===null?current[key]==null:current[key]===value);
    if(!matches)return {data:null,error:null};
    if(updateValue)Object.assign(current,updateValue);
    return {data:{...current},error:null};
   }
   return query;
  },
  async rpc(name,args){
   if(name!=="finalize_transaction_case_refund")throw new Error("Unexpected RPC "+name);
   state.finalizeCalls+=1;
   state.caseRow.status="resolved";
   state.caseRow.provider_refund_id=args.p_refund_id;
   return {data:true,error:null};
  }
 };

 const payments={
  isStripeCheckoutConfigured:()=>true,
  async refundPlatformPayment(){
   state.refundCreateCalls+=1;
   return {...state.refund};
  },
  async getRefund(id){
   state.refundReadCalls+=1;
   assert.equal(id,"re_fixture");
   return {...state.refund};
  },
  async reverseSellerTransfer(){
   throw new Error("Transfer reversal must not run in this fixture.");
  }
 };

 const source=fs.readFileSync(new URL("../src/lib/commerce-refunds.ts",import.meta.url),"utf8");
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(output,{
  exports,
  console,
  require(name){
   if(name==="server-only")return {};
   if(name==="@/lib/supabase/admin")return {createSupabaseAdminClient:()=>db};
   if(name==="@/lib/stripe-payments")return payments;
   throw new Error("Unexpected dependency "+name);
  }
 });

 return {state,refund:()=>exports.refundTransactionCase(caseId)};
}

test("matching succeeded provider refund can finalize the local full refund",async()=>{
 const f=fixture();
 const result=await f.refund();
 assert.equal(result.refunded,true);
 assert.equal(result.reason,"refunded");
 assert.equal(f.state.finalizeCalls,1);
});

for(const scenario of [
 {name:"amount",override:{amount:2999}},
 {name:"currency",override:{currency:"usd"}},
 {name:"payment intent",override:{payment_intent:"pi_other"}},
 {name:"missing payment intent",override:{payment_intent:null}}
]){
 test(`succeeded refund with mismatched ${scenario.name} stays unresolved`,async()=>{
  const f=fixture(scenario.override);
  const first=await f.refund();
  assert.equal(first.refunded,false);
  assert.equal(first.reason,"refund_unverified");
  assert.equal(f.state.caseRow.provider_refund_id,"re_fixture");
  assert.equal(f.state.finalizeCalls,0);
  assert.equal(f.state.refundCreateCalls,1);

  const second=await f.refund();
  assert.equal(second.refunded,false);
  assert.equal(second.reason,"refund_unverified");
  assert.equal(f.state.refundCreateCalls,1,"retry must reuse the correlated refund instead of creating another provider refund");
  assert.equal(f.state.refundReadCalls,1);
  assert.equal(f.state.finalizeCalls,0);
 });
}
