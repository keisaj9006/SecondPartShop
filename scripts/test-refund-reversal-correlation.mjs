import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const caseId="00000000-0000-4000-8000-000000000151";
const orderItemId="00000000-0000-4000-8000-000000000152";
const orderId="00000000-0000-4000-8000-000000000153";

function fixture(existingRaceReversalId,{reversalAmount=2200,persistedReversalId=null,persistedReversalAmount=2200}={}){
 const state={
  caseRow:{id:caseId,order_item_id:orderItemId,status:"open",provider_refund_id:null,provider_dispute_id:null},
  item:{
   id:orderItemId,
   order_id:orderId,
   quantity:1,
   unit_price_pence:2500,
   shipping_pence:500,
   seller_net_pence:2200,
   payout_status:persistedReversalId?"reversed":"released",
   funds_released_at:"2026-09-11T20:19:18Z",
   provider_transfer_id:"tr_fixture",
   provider_transfer_reversal_id:persistedReversalId
  },
  order:{id:orderId,provider_payment_intent_id:"pi_fixture",payment_status:"paid"},
  reversalCalls:0,
  reversalLookupCalls:0,
  refundCreateCalls:0,
  finalizeCalls:0,
  raceApplied:false
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

    if(
     table==="order_items"&&
     updateValue?.provider_transfer_reversal_id&&
     nullFilters.some(([key,value])=>key==="provider_transfer_reversal_id"&&value===null)&&
     !state.raceApplied
    ){
     state.raceApplied=true;
     state.item.provider_transfer_reversal_id=existingRaceReversalId;
     state.item.payout_status="reversed";
     return {data:null,error:null};
    }

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
  async reverseSellerTransfer(){
   state.reversalCalls+=1;
   return {id:"trr_expected",amount:reversalAmount};
  },
  async getSellerTransferReversal(_transferId,reversalId){
   state.reversalLookupCalls+=1;
   return {id:reversalId,amount:persistedReversalAmount};
  },
  async refundPlatformPayment(){
   state.refundCreateCalls+=1;
   return {id:"re_fixture",status:"succeeded",amount:3000,currency:"gbp",payment_intent:"pi_fixture"};
  },
  async getRefund(){throw new Error("Refund lookup must not run in this fixture.");}
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

test("a competing write with the same reversal id remains idempotent",async()=>{
 const f=fixture("trr_expected");
 const result=await f.refund();
 assert.equal(result.refunded,true);
 assert.equal(f.state.reversalCalls,1);
 assert.equal(f.state.refundCreateCalls,1);
 assert.equal(f.state.finalizeCalls,1);
});

test("a competing write with a different reversal id stops before refund creation",async()=>{
 const f=fixture("trr_other");
 await assert.rejects(f.refund(),/reversal correlation mismatch/i);
 assert.equal(f.state.reversalCalls,1);
 assert.equal(f.state.refundCreateCalls,0,"conflicting reversal authority must stop before creating a refund");
 assert.equal(f.state.finalizeCalls,0);
 assert.equal(f.state.caseRow.provider_refund_id,null);
});

test("a reversal with a mismatched amount stops before correlation or refund creation",async()=>{
 const f=fixture("trr_expected",{reversalAmount:2199});
 await assert.rejects(f.refund(),/reversal amount mismatch/i);
 assert.equal(f.state.reversalCalls,1);
 assert.equal(f.state.refundCreateCalls,0,"mismatched reversal amount must stop before creating a refund");
 assert.equal(f.state.finalizeCalls,0);
 assert.equal(f.state.caseRow.provider_refund_id,null);
});

test("a persisted reversal is revalidated with Stripe before refund creation",async()=>{
 const f=fixture(null,{persistedReversalId:"trr_persisted",persistedReversalAmount:2200});
 const result=await f.refund();
 assert.equal(result.refunded,true);
 assert.equal(f.state.reversalCalls,0,"persisted reversal must not create another provider reversal");
 assert.equal(f.state.reversalLookupCalls,1,"persisted reversal must be re-read from Stripe");
 assert.equal(f.state.refundCreateCalls,1);
 assert.equal(f.state.finalizeCalls,1);
});

test("a persisted reversal with a mismatched provider amount blocks refund creation",async()=>{
 const f=fixture(null,{persistedReversalId:"trr_persisted",persistedReversalAmount:2199});
 await assert.rejects(f.refund(),/reversal amount mismatch/i);
 assert.equal(f.state.reversalCalls,0);
 assert.equal(f.state.reversalLookupCalls,1,"persisted reversal must be checked against provider authority");
 assert.equal(f.state.refundCreateCalls,0,"unverified persisted reversal must stop before creating a refund");
 assert.equal(f.state.finalizeCalls,0);
 assert.equal(f.state.caseRow.provider_refund_id,null);
});
