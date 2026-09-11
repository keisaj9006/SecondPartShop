import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compiled=ts.transpileModule(fs.readFileSync("src/lib/commerce-payouts.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function worker({future=false,lostResponse=false,activeCase=false}={}){
 const item={id:"qa-item",order_id:"qa-order",seller_id:"qa-seller",seller_net_pence:1250,
  payout_status:"scheduled",release_eligible_at:new Date(Date.now()+(future?86400000:-1000)).toISOString(),
  provider_transfer_id:null,funds_released_at:null,payout_rollback_required:false,provider_transfer_reversal_id:null};
 let transfer=null;let creates=0;let lookups=0;let releases=0;
 const admin={
  from(table){
   const result=()=>({error:null,count:activeCase?1:0,data:table==="order_items"?{...item}:table==="orders"
    ?{payment_status:"paid",provider_charge_id:"ch_test"}:{provider_account_id:"acct_test",transfers_enabled:true,onboarding_status:"complete"}});
   const query={select(){return query;},eq(){return query;},in(){return Promise.resolve(result());},maybeSingle(){return Promise.resolve(result());}};
   return query;
  },
  async rpc(name,args){
   assert.equal(args.p_order_item_id,item.id);
   if(name==="claim_order_item_payout_release"){
    const claimed=item.payout_status==="scheduled";
    if(claimed)item.payout_status="releasing";
    return {data:claimed,error:null};
   }
   if(name==="recover_order_item_payout_transfer"){item.provider_transfer_id=args.p_transfer_id;return {data:true,error:null};}
   if(name==="mark_order_item_payout_released"){
    releases++;item.payout_status="released";item.funds_released_at=new Date().toISOString();return {data:true,error:null};
   }
   if(name==="abandon_empty_order_item_payout_release_claim"){item.payout_status="on_hold";return {data:true,error:null};}
   throw new Error("Unexpected RPC: "+name);
  }
 };
 const exports={};
 vm.runInNewContext(compiled,{exports,Date,require(name){
  if(name==="server-only")return {};
  if(name==="@/lib/supabase/admin")return {createSupabaseAdminClient:()=>admin};
  if(name==="@/lib/stripe-payments")return {
   isStripeCheckoutConfigured:()=>true,
   async findSellerTransferForAttempt(input){lookups++;assert.equal(input.orderItemId,item.id);return transfer;},
   async createSellerTransfer(input){
    creates++;assert.equal(input.destinationAccountId,"acct_test");assert.equal(input.amountPence,1250);
    transfer={id:"tr_test",amount:1250,currency:"gbp",destination:"acct_test"};
    if(lostResponse){lostResponse=false;throw new Error("Provider response lost after creation");}
    return transfer;
   },
   async getSellerTransferReversals(){return {data:[]};}
  };
  throw new Error(name);
 }});
 return {run:()=>exports.releaseDuePayoutItem(item.id),stats:()=>({creates,lookups,releases}),item};
}

test("repeated payout invocation returns already_released without another provider call",async()=>{
 const payout=worker();
 assert.equal((await payout.run()).reason,"released");
 assert.equal((await payout.run()).reason,"already_released");
 assert.equal((await payout.run()).reason,"already_released");
 assert.deepEqual(payout.stats(),{creates:1,lookups:1,releases:1});
});

test("receipt protection window prevents transfer before eligibility",async()=>{
 const payout=worker({future:true});
 assert.equal((await payout.run()).reason,"not_due");
 assert.deepEqual(payout.stats(),{creates:0,lookups:0,releases:0});
});

test("retry recovers a provider transfer after its response is lost",async()=>{
 const payout=worker({lostResponse:true});
 await assert.rejects(payout.run(),/response lost/);
 assert.equal(payout.item.provider_transfer_id,null);
 assert.equal((await payout.run()).reason,"released");
 assert.equal(payout.item.provider_transfer_id,"tr_test");
 assert.deepEqual(payout.stats(),{creates:1,lookups:2,releases:1});
});

test("an active case prevents creation even after a release claim",async()=>{
 const payout=worker({activeCase:true});
 assert.equal((await payout.run()).reason,"claim_abandoned_unsafe");
 assert.deepEqual(payout.stats(),{creates:0,lookups:1,releases:0});
});
