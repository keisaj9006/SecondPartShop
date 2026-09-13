import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const caseId='00000000-0000-4000-8000-000000000041';
const orderItemId='00000000-0000-4000-8000-000000000042';
const orderId='00000000-0000-4000-8000-000000000043';

function fixture(options={}){
 const state={
  refundStatus:'succeeded',
  refundId:'re_fixture',
  refundCreateCalls:0,
  refundReadCalls:0,
  reversalCalls:0,
  finalizeCalls:0,
  refundKeys:[],
  finalizeError:false,
  finalizeData:true,
  caseRow:{id:caseId,order_item_id:orderItemId,status:'open',provider_refund_id:null,provider_dispute_id:null},
  item:{id:orderItemId,order_id:orderId,quantity:1,unit_price_pence:2500,shipping_pence:500,seller_net_pence:2200,payout_status:'blocked',funds_released_at:null,provider_transfer_id:null,provider_transfer_reversal_id:null},
  order:{id:orderId,provider_payment_intent_id:'pi_fixture',payment_status:'paid'},
  ...options
 };
 if(options.providerRefundId!==undefined)state.caseRow.provider_refund_id=options.providerRefundId;
 if(options.payoutReleased){
  state.item.payout_status='released';
  state.item.funds_released_at='2026-09-01T10:00:00Z';
  state.item.provider_transfer_id='tr_fixture';
 }

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
    if(table==='transaction_cases')return state.caseRow;
    if(table==='order_items')return state.item;
    if(table==='orders')return state.order;
    return null;
   }
   function run(){
    const current=row();
    if(!current)return {data:null,error:null};
    const matches=filters.every(([key,value])=>current[key]===value)&&nullFilters.every(([key,value])=>value===null?current[key]==null:current[key]===value);
    if(!matches)return {data:null,error:null};
    if(updateValue)Object.assign(current,updateValue);
    return {data:{...current},error:null};
   }
   return query;
  },
  async rpc(name,args){
   if(name!=='finalize_transaction_case_refund')throw new Error('Unexpected RPC '+name);
   state.finalizeCalls+=1;
   if(state.finalizeError)return {data:null,error:{code:'finalize_failed'}};
   if(state.finalizeData!==true)return {data:state.finalizeData,error:null};
   state.caseRow.status='resolved';
   state.caseRow.provider_refund_id=args.p_refund_id;
   state.item.provider_transfer_reversal_id=args.p_transfer_reversal_id??state.item.provider_transfer_reversal_id;
   return {data:true,error:null};
  }
 };

 const payments={
  isStripeCheckoutConfigured:()=>true,
  async refundPlatformPayment(input){
   state.refundCreateCalls+=1;
   state.refundKeys.push(input.idempotencyKey);
   return {id:state.refundId,status:state.refundStatus,amount:3000};
  },
  async getRefund(id){
   state.refundReadCalls+=1;
   assert.equal(id,state.refundId);
   return {id:state.refundId,status:state.refundStatus,amount:3000};
  },
  async reverseSellerTransfer(){
   state.reversalCalls+=1;
   return {id:'trr_fixture',amount:2200};
  }
 };

 function load(){
  const source=fs.readFileSync(new URL('../src/lib/commerce-refunds.ts',import.meta.url),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(output,{exports,console,require(name){
   if(name==='server-only')return {};
   if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>db};
   if(name==='@/lib/stripe-payments')return payments;
   throw new Error('Unexpected dependency '+name);
  }});
  return exports;
 }

 return {state,refund:()=>load().refundTransactionCase(caseId)};
}

test('pending refund is correlated durably but does not finalize the case',async()=>{
 const f=fixture({refundStatus:'pending'});
 const result=await f.refund();
 assert.equal(result.refunded,false);
 assert.equal(result.reason,'refund_pending');
 assert.equal(result.refundId,'re_fixture');
 assert.equal(f.state.caseRow.provider_refund_id,'re_fixture');
 assert.equal(f.state.finalizeCalls,0);
 assert.equal(f.state.refundCreateCalls,1);
 assert.equal(f.state.refundKeys[0],'secondpart-refund-'+caseId);
});

test('requires-action refund stays unresolved and correlated',async()=>{
 const f=fixture({refundStatus:'requires_action'});
 const result=await f.refund();
 assert.equal(result.refunded,false);
 assert.equal(result.reason,'refund_pending');
 assert.equal(f.state.caseRow.provider_refund_id,'re_fixture');
 assert.equal(f.state.finalizeCalls,0);
});

for(const status of ['failed','canceled'])test(status+' refund never finalizes the transaction case',async()=>{
 const f=fixture({refundStatus:status});
 const result=await f.refund();
 assert.equal(result.refunded,false);
 assert.equal(result.reason,'refund_failed');
 assert.equal(result.refundId,'re_fixture');
 assert.equal(f.state.caseRow.provider_refund_id,'re_fixture');
 assert.equal(f.state.finalizeCalls,0);
});

test('succeeded refund finalizes exactly once',async()=>{
 const f=fixture({refundStatus:'succeeded'});
 const result=await f.refund();
 assert.equal(result.refunded,true);
 assert.equal(result.reason,'refunded');
 assert.equal(f.state.finalizeCalls,1);
 assert.equal(f.state.caseRow.provider_refund_id,'re_fixture');
});

test('retry of a correlated pending refund reads provider state instead of creating another refund',async()=>{
 const f=fixture({refundStatus:'pending',providerRefundId:'re_fixture'});
 const result=await f.refund();
 assert.equal(result.refunded,false);
 assert.equal(result.reason,'refund_pending');
 assert.equal(f.state.refundCreateCalls,0);
 assert.equal(f.state.refundReadCalls,1);
 assert.equal(f.state.finalizeCalls,0);
});

test('database finalization error keeps provider correlation and retry finalizes without another POST',async()=>{
 const f=fixture({refundStatus:'succeeded',finalizeError:true});
 await assert.rejects(f.refund());
 assert.equal(f.state.caseRow.provider_refund_id,'re_fixture');
 assert.equal(f.state.refundCreateCalls,1);
 assert.equal(f.state.finalizeCalls,1);
 f.state.finalizeError=false;
 const result=await f.refund();
 assert.equal(result.refunded,true);
 assert.equal(f.state.refundCreateCalls,1);
 assert.equal(f.state.refundReadCalls,1);
 assert.equal(f.state.finalizeCalls,2);
});

test('database finalization false acknowledgement stays retryable without another provider refund',async()=>{
 const f=fixture({refundStatus:'succeeded',finalizeData:false});
 await assert.rejects(f.refund(),/finalization/i);
 assert.equal(f.state.caseRow.provider_refund_id,'re_fixture');
 assert.equal(f.state.refundCreateCalls,1);
 f.state.finalizeData=true;
 const result=await f.refund();
 assert.equal(result.refunded,true);
 assert.equal(f.state.refundCreateCalls,1);
 assert.equal(f.state.refundReadCalls,1);
 assert.equal(f.state.finalizeCalls,2);
});

test('released seller payout is reversed once before a successful refund and the retry is a no-op',async()=>{
 const f=fixture({refundStatus:'succeeded',payoutReleased:true});
 const first=await f.refund();
 const second=await f.refund();
 assert.equal(first.refunded,true);
 assert.equal(second.reason,'already_refunded');
 assert.equal(f.state.reversalCalls,1);
 assert.equal(f.state.refundCreateCalls,1);
 assert.equal(f.state.finalizeCalls,1);
});

test('pending refund persists a released-payout reversal and retry never reverses twice',async()=>{
 const f=fixture({refundStatus:'pending',payoutReleased:true});
 const first=await f.refund();
 const second=await f.refund();
 assert.equal(first.reason,'refund_pending');
 assert.equal(second.reason,'refund_pending');
 assert.equal(f.state.item.provider_transfer_reversal_id,'trr_fixture');
 assert.equal(f.state.item.payout_status,'reversed');
 assert.equal(f.state.reversalCalls,1);
 assert.equal(f.state.refundCreateCalls,1);
 assert.equal(f.state.refundReadCalls,1);
 assert.equal(f.state.finalizeCalls,0);
});
