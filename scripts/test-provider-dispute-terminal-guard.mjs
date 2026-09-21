import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const compiled=ts.transpileModule(fs.readFileSync('src/lib/commerce-provider-disputes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({caseStatus='under_review',outcome='needs_response',missing=false,readError=false}={}){
 const effects={reversals:0,finalizations:0,reads:0};
 const db={from(table){const q={select(){return q;},eq(){return q;},async maybeSingle(){effects.reads++;return {error:readError?new Error('unavailable'):null,data:missing?null:table==='transaction_cases'?{order_item_id:'item',status:caseStatus,provider_dispute_status:outcome}:{id:'item',seller_net_pence:500,payout_status:'released',funds_released_at:'2026-09-01',provider_transfer_id:'tr_fixture',provider_transfer_reversal_id:null}};}};return q;},async rpc(name){if(name==='claim_provider_dispute_reversal')return {data:[{claimed:true,transfer_id:'tr_fixture',amount_pence:500,reversal_id:null}],error:null};if(name==='record_provider_dispute_reversal')return {data:true,error:null};effects.finalizations++;return {data:true,error:null};}};
 const exports={};
 vm.runInNewContext(compiled,{exports,require(name){if(name==='server-only')return {};if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>db};if(name==='@/lib/stripe-payments')return {reverseSellerTransfer:async(transfer,amount,key)=>{effects.reversals++;assert.equal(transfer,'tr_fixture');assert.equal(amount,500);assert.equal(key,'secondpart-provider-dispute-reversal-dp_fixture');return {id:'trr_fixture',amount:500,currency:'gbp',transfer:'tr_fixture',metadata:{secondpart_dispute_id:'dp_fixture'}};}};throw Error(name);}});
 return {effects,run:(status='lost')=>exports.closeProviderPaymentDispute({eventId:'evt_fixture',disputeId:'dp_fixture',status})};
}
for(const [previous,next] of [['won','lost'],['warning_closed','lost'],['lost','won'],['lost','warning_closed']])test(`terminal ${previous} cannot be overwritten by ${next} or cause a transfer reversal`,async()=>{
 const f=fixture({caseStatus:'resolved',outcome:previous});await assert.rejects(f.run(next),/conflict|terminal/i);assert.equal(f.effects.reversals,0);assert.equal(f.effects.finalizations,0);
});
for(const next of ['needs_response','', 'unexpected'])test(`unsupported close status ${JSON.stringify(next)} cannot finalize`,async()=>{
 const f=fixture();await assert.rejects(f.run(next),/unsupported|terminal/i);assert.equal(f.effects.reversals,0);assert.equal(f.effects.finalizations,0);
});
test('unavailable case evidence cannot finalize a won event',async()=>{const f=fixture({readError:true});await assert.rejects(f.run('won'),/unavailable/);assert.equal(f.effects.finalizations,0);});
test('missing case retries without provider mutation or acknowledgement',async()=>{const f=fixture({missing:true});await assert.rejects(f.run(),/linkage|case/i);assert.equal(f.effects.reversals,0);assert.equal(f.effects.finalizations,0);});
test('matching terminal outcome still delegates durable duplicate acknowledgement',async()=>{const f=fixture({caseStatus:'resolved',outcome:'won'});assert.equal((await f.run('won')).closed,true);assert.equal(f.effects.reversals,0);assert.equal(f.effects.finalizations,1);});
test('ordinary lost event preserves reversal and finalization',async()=>{const f=fixture();assert.equal((await f.run()).closed,true);assert.equal(f.effects.reversals,1);assert.equal(f.effects.finalizations,1);});
