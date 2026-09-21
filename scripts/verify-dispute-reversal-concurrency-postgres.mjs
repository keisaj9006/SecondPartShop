import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {disputeRecoverySchema} from './lib/dispute-recovery-fixture.mjs';

const url=process.env.TEST_DATABASE_URL;
if(!url)throw new Error('TEST_DATABASE_URL is required for isolated PostgreSQL proof.');
const target=new URL(url);
if(!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/secondpart_dispute_rc'){
 throw new Error('Only the disposable local secondpart_dispute_rc database is permitted.');
}
const pg=await import(process.env.PG_CLIENT_MODULE?pathToFileURL(process.env.PG_CLIENT_MODULE).href:'pg');
const Client=pg.Client??pg.default.Client;
const clients=Array.from({length:3},()=>new Client({connectionString:url,statement_timeout:15000}));
const [setup,a,b]=clients;
const id=n=>'71000000-0000-4000-8000-'+String(n).padStart(12,'0');
const migrate=name=>setup.query(fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
async function seed(n){
 await setup.query("insert into orders values($1,$2,'paid','processing',$3)",[id(n),id(999),'ch_'+n]);
 await setup.query("insert into order_items(id,order_id,part_id,seller_id,fulfilment_status,payout_status,funds_released_at,provider_transfer_id,seller_net_pence) values($1,$2,'50000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000003','delivered','released',now(),$3,500)",[id(100+n),id(n),'tr_'+n]);
 await setup.query('select open_provider_payment_dispute($1,$2,$3,$4,null)',['evt_open_'+n,'dp_'+n,'ch_'+n,'needs_response']);
}
async function waitForLock(pid){
 const deadline=Date.now()+5000;
 while(Date.now()<deadline){
  const result=await setup.query('select wait_event_type from pg_stat_activity where pid=$1',[pid]);
  if(result.rows[0]?.wait_event_type==='Lock')return;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 throw new Error('Second connection never reached the expected database lock.');
}
const claim=(c,n)=>c.query('select * from claim_provider_dispute_reversal($1)',['dp_'+n]);
const won=(c,n)=>c.query('select close_provider_payment_dispute($1,$2,$3,null)',['evt_won_'+n,'dp_'+n,'won']);
try{
 await Promise.all(clients.map(c=>c.connect()));
 assert.equal((await setup.query("select count(*)::int n from pg_tables where schemaname in ('public','private')")).rows[0].n,0,'Database must be empty; no resets or drops are performed.');
 await setup.query(disputeRecoverySchema);
 for(const name of ['20260906183500_provider_payment_disputes.sql','20260907162000_reverse_released_payout_on_lost_provider_dispute.sql','20260913102500_provider_dispute_event_ordering.sql','20260921075633_provider_dispute_reversal_recovery.sql'])await migrate(name);
 for(const c of [a,b])await c.query('set role service_role');
 const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
 await seed(1);
 await a.query('begin');assert.equal((await claim(a,1)).rows[0].claimed,true);
 const competing=claim(b,1);await waitForLock(pid);await a.query('commit');
 assert.equal((await competing).rows[0].claimed,false);
 console.log('PASS two overlapping claims: exactly one authorization');
 await seed(2);await a.query('begin');await claim(a,2);
 const blockedWon=won(b,2).then(()=>null,error=>error);await waitForLock(pid);await a.query('commit');
 assert.match((await blockedWon)?.message??'',/reversal claim/i);
 console.log('PASS claim commits first: contradictory won close rejected');
 await seed(3);await a.query('begin');await won(a,3);
 const blockedClaim=claim(b,3).then(()=>null,error=>error);await waitForLock(pid);await a.query('commit');
 assert.match((await blockedClaim)?.message??'',/terminal outcome/i);
 console.log('PASS won close commits first: provider mutation claim rejected');
 assert.equal((await setup.query("select count(*)::int n from private.provider_dispute_reversals")).rows[0].n,2);
 console.log('PostgreSQL '+(await setup.query('show server_version')).rows[0].server_version+'; real independent connections; no provider calls.');
}finally{
 await a.query('rollback').catch(()=>{});
 await Promise.all(clients.map(c=>c.end().catch(()=>{})));
}
