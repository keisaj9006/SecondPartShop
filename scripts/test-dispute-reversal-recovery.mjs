import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync('src/lib/commerce-provider-disputes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({lostResponse=false,recordFailure=false,closeFailure=false,providerMismatch=false,more=false,unrelated=false,wrongCurrency=false,wrongTransfer=false,duplicate=false,wrongStoredId=false,claimError=false,emptyClaim=false}={}){
 let attempt=null,provider=null;
 const effects={creates:0,lists:0,gets:0,closes:0};
 const item={id:'item',seller_net_pence:500,payout_status:'released',funds_released_at:'date',provider_transfer_id:'tr_fixture',provider_transfer_reversal_id:null};
 const db={from(){const q={select(){return q;},eq(){return q;},async maybeSingle(){return {data:{order_item_id:'item',status:'under_review',provider_dispute_status:'needs_response',...item},error:null};}};return q;},async rpc(name,args){
  if(name==='claim_provider_dispute_reversal'){if(claimError)throw Error('claim unavailable');if(emptyClaim)return {data:[],error:null};const claimed=!attempt;attempt??={transfer_id:'tr_fixture',amount_pence:500,reversal_id:null};return {data:[{claimed,...attempt}],error:null};}
  if(name==='record_provider_dispute_reversal'){if(recordFailure){recordFailure=false;throw Error('record unavailable');}assert.equal(args.p_transfer_id,'tr_fixture');assert.equal(args.p_amount_pence,500);attempt.reversal_id=args.p_reversal_id;return {data:true,error:null};}
  if(name==='close_provider_payment_dispute'){effects.closes++;if(closeFailure){closeFailure=false;throw Error('close unavailable');}return {data:true,error:null};}
  throw Error(name);
 }};
 const exports={};vm.runInNewContext(compiled,{exports,require(name){if(name==='server-only')return {};if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>db};if(name==='@/lib/stripe-payments')return {
  reverseSellerTransfer:async()=>{effects.creates++;provider={id:'trr_fixture',amount:providerMismatch?499:500,currency:wrongCurrency?'usd':'gbp',transfer:wrongTransfer?'tr_other':'tr_fixture',metadata:{secondpart_dispute_id:unrelated?'dp_other':'dp_fixture'}};if(lostResponse){lostResponse=false;throw Error('response lost');}return provider;},
  getSellerTransferReversals:async()=>{effects.lists++;return {data:provider?(duplicate?[provider,provider]:[provider]):[],has_more:more};},
  getSellerTransferReversal:async()=>{effects.gets++;return wrongStoredId?{...provider,id:"trr_other"}:provider;}
 };throw Error(name);}});
 return {run:()=>exports.closeProviderPaymentDispute({eventId:'evt_fixture',disputeId:'dp_fixture',status:'lost'}),effects,clearEvidence:()=>{provider=null;}};
}
for(const boundary of ['lostResponse','recordFailure','closeFailure'])test(`retry after ${boundary} never issues another reversal`,async()=>{const f=fixture({[boundary]:true});await assert.rejects(f.run());assert.equal((await f.run()).closed,true);assert.equal(f.effects.creates,1);});
test('two overlapping workers cannot both send the provider mutation',async()=>{const f=fixture();const outcomes=await Promise.allSettled([f.run(),f.run()]);assert.ok(outcomes.some(x=>x.status==='fulfilled'));assert.equal(f.effects.creates,1);});
test('unknown outcome with no provider evidence stays blocked across retries',async()=>{const f=fixture({lostResponse:true});await assert.rejects(f.run());f.clearEvidence();await assert.rejects(f.run(),/reconcil|evidence|unknown/i);assert.equal(f.effects.creates,1);assert.equal(f.effects.closes,0);});
for(const option of ['providerMismatch','unrelated','more','wrongCurrency','wrongTransfer','duplicate'])test(`ambiguous ${option} cannot authorize close or a replacement reversal`,async()=>{const f=fixture({lostResponse:true,[option]:true});await assert.rejects(f.run());await assert.rejects(f.run());assert.equal(f.effects.creates,1);assert.equal(f.effects.closes,0);});

for(const option of ['claimError','emptyClaim'])test(option+' blocks the provider request',async()=>{const f=fixture({[option]:true});await assert.rejects(f.run());assert.equal(f.effects.creates,0);assert.equal(f.effects.closes,0);});
test('stored reversal retrieval must return the same identifier',async()=>{const f=fixture({closeFailure:true,wrongStoredId:true});await assert.rejects(f.run());await assert.rejects(f.run(),/evidence/i);assert.equal(f.effects.creates,1);assert.equal(f.effects.closes,1);});
