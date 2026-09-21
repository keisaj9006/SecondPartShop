import {disputeRecoverySchema} from "./lib/dispute-recovery-fixture.mjs";
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const migration=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const candidate='20260913102500_provider_dispute_event_ordering.sql';
const baseline=false;
const candidateUrl=new URL('../supabase/migrations/'+candidate,import.meta.url);
const id=n=>'50000000-0000-4000-8000-'+String(n).padStart(12,'0');
const buyer=id(1);
const seller=id(3);
const part=id(4);

async function asService(db,sql,params=[]){
 await db.exec('set role service_role');
 try{return await db.query(sql,params);}finally{await db.exec('reset role');}
}

async function openDispute(db,{event,dispute,charge,status='needs_response',reason='fraudulent'}){
 const result=await asService(db,'select public.open_provider_payment_dispute($1,$2,$3,$4,$5) result',[event,dispute,charge,status,reason]);
 return result.rows[0].result;
}

async function closeDispute(db,{event,dispute,status='won',reversal=null}){
 const result=await asService(db,'select public.close_provider_payment_dispute($1,$2,$3,$4) result',[event,dispute,status,reversal]);
 return result.rows[0].result;
}

async function count(db,table,where='',params=[]){
 return Number((await db.query(`select count(*) count from public.${table}${where?' where '+where:''}`,params)).rows[0].count);
}

async function seedOrder(db,n,{charge=`ch_${n}`,fulfilment='delivered',payout='scheduled'}={}){
 const orderId=id(100+n);
 const itemId=id(200+n);
 await db.query('insert into public.orders(id,buyer_id,payment_status,status,provider_charge_id) values($1,$2,$3,$4,$5)',[orderId,buyer,'paid','processing',charge]);
 await db.query(`insert into public.order_items(
  id,order_id,part_id,seller_id,fulfilment_status,payout_status,release_eligible_at
 ) values($1,$2,$3,$4,$5,$6,now()+interval '48 hours')`,[itemId,orderId,part,seller,fulfilment,payout]);
 return {orderId,itemId,charge};
}

async function buildDatabase({beforeRecovery}={}){
 const db=new PGlite();
 await db.exec(disputeRecoverySchema);
 await db.exec(migration('20260906183500_provider_payment_disputes.sql'));
 await db.exec(migration('20260907162000_reverse_released_payout_on_lost_provider_dispute.sql'));
 if(!baseline&&fs.existsSync(candidateUrl))await db.exec(fs.readFileSync(candidateUrl,'utf8'));
 if(beforeRecovery)await beforeRecovery(db);
 const recovery=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(name=>name.endsWith('_provider_dispute_reversal_recovery.sql'));
 if(recovery)await db.exec(migration(recovery));
 return db;
}


test('dispute reversal recovery and terminal authority in actual SQL',async t=>{
 const db=await buildDatabase();
 const prepare=async(n,released=true)=>{const s=await seedOrder(db,n,{payout:released?'released':'scheduled'});if(released)await db.query("update order_items set funds_released_at=now(),provider_transfer_id=$2 where id=$1",[s.itemId,'tr_'+n]);await openDispute(db,{event:'evt_open_'+n,dispute:'dp_'+n,charge:s.charge});return s;};
 const claim=n=>asService(db,'select * from claim_provider_dispute_reversal($1)',['dp_'+n]);
 const record=(n,transfer='tr_'+n,reversal='trr_'+n,amount=500)=>asService(db,'select record_provider_dispute_reversal($1,$2,$3,$4) result',['dp_'+n,transfer,reversal,amount]);
 const close=(n,status='lost',reversal=null,event='evt_close_'+n)=>closeDispute(db,{event,dispute:'dp_'+n,status,reversal});
 try{
 await t.test('SQL rejects contradictory resolved outcomes without consuming new event',async()=>{await prepare(10,false);await close(10,'won');await assert.rejects(close(10,'lost',null,'evt_conflicting_10'),/terminal|conflict/i);assert.equal((await db.query("select provider_dispute_status from transaction_cases where provider_dispute_id='dp_10'")).rows[0].provider_dispute_status,'won');});
 await t.test('unsupported outcome leaves case active',async()=>{await prepare(11,false);await assert.rejects(close(11,'needs_response'),/terminal|unsupported/i);assert.equal((await db.query("select status from transaction_cases where provider_dispute_id='dp_11'")).rows[0].status,'under_review');});
 await t.test('only one claim authorizes a provider operation and it cannot expire',async()=>{await prepare(12);assert.equal((await claim(12)).rows[0].claimed,true);assert.equal((await claim(12)).rows[0].claimed,false);await db.exec("update private.provider_dispute_reversals set created_at=now()-interval '10 days'");assert.equal((await claim(12)).rows[0].claimed,false);await assert.rejects(close(12,'won'),/reversal|claim/i);});
 await t.test('unrecorded or mismatched evidence never closes a released payout',async()=>{await prepare(13);await claim(13);await assert.rejects(close(13,'lost','trr_13'),/evidence|record/i);await assert.rejects(record(13,'tr_wrong'),/binding|match/i);await assert.rejects(record(13,'tr_13','trr_13',499),/binding|match/i);await assert.rejects(record(13,'tr_13','trr_13',null),/binding|match/i);await record(13);await assert.rejects(record(13,'tr_13','trr_other'),/conflict|different/i);assert.equal(await close(13,'lost','trr_13'),true);assert.equal(await close(13,'lost',null,'evt_duplicate_13'),true);assert.equal(await count(db,'order_events',"event_type='provider_dispute_closed' and metadata->>'provider_dispute_id'='dp_13'"),1);});
 await t.test('won first prevents a subsequent money claim',async()=>{await prepare(14);await close(14,'won');await assert.rejects(claim(14),/terminal|conflict/i);});
 await t.test('opening a dispute preserves an in-flight payout claim',async()=>{const seeded=await seedOrder(db,18,{payout:'releasing'});await openDispute(db,{event:'evt_open_18',dispute:'dp_18',charge:seeded.charge});assert.equal((await db.query('select payout_status from order_items where id=$1',[seeded.itemId])).rows[0].payout_status,'releasing');});
 await t.test('in-flight payout cannot be closed or claimed',async()=>{const s=await prepare(15,false);await db.query("update order_items set payout_status='releasing' where id=$1",[s.itemId]);await assert.rejects(claim(15),/payout|transfer/i);await assert.rejects(close(15,'won'),/payout|transfer/i);});
 await t.test('legacy terminal lost label alone cannot acknowledge missing recovery',async()=>{await prepare(16);await db.exec("update transaction_cases set status='resolved',provider_dispute_status='lost' where provider_dispute_id='dp_16'");await assert.rejects(close(16),/reversal|evidence/i);await claim(16);await record(16);assert.equal(await close(16,'lost','trr_16'),true);assert.equal((await db.query("select payout_status from order_items where provider_transfer_id='tr_16'")).rows[0].payout_status,'reversed');});
 await t.test('a reversed payout missing its reversal ID cannot authorize another mutation',async()=>{const item=await prepare(19);await db.query("update order_items set payout_status='reversed' where id=$1",[item.itemId]);await assert.rejects(claim(19),/evidence|reconciliation/i);});
 await t.test('unreleased lost case closes without a provider operation',async()=>{await prepare(17,false);assert.equal(await close(17),true);});
 await t.test('internal evidence and RPC privileges remain denied to users',async()=>{for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query("select * from private.provider_dispute_reversals"),/permission denied/i);await assert.rejects(db.query("select * from claim_provider_dispute_reversal('dp_12')"),/permission denied/i);await db.exec('reset role');}for(const signature of ['claim_provider_dispute_reversal(text)','record_provider_dispute_reversal(text,text,text,integer)','close_provider_payment_dispute(text,text,text,text)'])assert.equal((await db.query("select has_function_privilege('service_role',$1,'execute') allowed",[signature])).rows[0].allowed,true);});
 }finally{await db.close();}
});

test('migration rollout quarantines legacy ambiguous reversals instead of authorizing a replacement',async()=>{
 const db=await buildDatabase({beforeRecovery:async db=>{const s=await seedOrder(db,90,{payout:'released'});await db.query("update order_items set funds_released_at=now(),provider_transfer_id='tr_legacy' where id=$1",[s.itemId]);await openDispute(db,{event:'evt_legacy',dispute:'dp_legacy',charge:s.charge});}});
 try{const result=await asService(db,"select * from claim_provider_dispute_reversal('dp_legacy')");assert.equal(result.rows[0].claimed,false);assert.equal(result.rows[0].reversal_id,null);}finally{await db.close();}
});
