import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const requestId='11111111-1111-4111-8111-111111111111';
const profileId='22222222-2222-4222-8222-222222222222';
const otherId='33333333-3333-4333-8333-333333333333';
const source=ts.transpileModule(fs.readFileSync('src/app/api/privacy/maintenance/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(options={}){
 const calls={queue:0,images:0,processed:[],reads:[],alerts:0};
 const env={CRON_SECRET:'test-maintenance-secret',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/final-rc-hardening',NEXT_PUBLIC_SUPABASE_URL:'https://etkupijfdznljimrfyct.supabase.co',RC_QA_DELETION_TARGETS:JSON.stringify({[requestId]:profileId}),...options.env};
 const row=options.row===undefined?{id:requestId,status:'requested',profile_id:profileId,target_profile_id:null}:options.row;
 const query={select(){return this;},eq(key,value){calls.reads.push([key,value]);return this;},async maybeSingle(){return {data:row,error:options.readError??null};}};
 const deps={
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@/lib/account-deletion':{processAccountDeletionQueue:async()=>{calls.queue++;return {};},processAccountDeletionRequest:async(id)=>{calls.processed.push(id);if(options.workerError)throw new Error('private upstream detail');return {requestId:id,status:'completed'};}},
  '@/lib/part-image-cleanup':{processPartImageCleanup:async()=>{calls.images++;return {}; }},
  '@/lib/ops-monitoring':{reportOperationalError:async()=>{calls.alerts++;}},
  '@/lib/supabase/admin':{createSupabaseAdminClient:()=>({from(table){assert.equal(table,'account_deletion_requests');return query;}})},
 };
 const exports={};vm.runInNewContext(source,{exports,require(name){assert.ok(name in deps,name);return deps[name];},process:{env},URL,Response});
 return {calls,run:(search=`?qa=1&requestId=${requestId}`,auth='Bearer test-maintenance-secret')=>exports.GET(new Request('https://preview.example/api/privacy/maintenance'+search,{headers:auth?{authorization:auth}:{}}))};
}
const noWorkers=calls=>{assert.equal(calls.queue,0);assert.equal(calls.images,0);assert.deepEqual(calls.processed,[]);};

test('scoped request invokes only exact existing processor',async()=>{
 const h=harness();const response=await h.run();assert.equal(response.status,200);
 assert.deepEqual(h.calls.processed,[requestId]);assert.equal(h.calls.queue,0);assert.equal(h.calls.images,0);
 assert.deepEqual(h.calls.reads,[['id',requestId]]);assert.equal((await response.json()).result.status,'completed');
});
for(const [name,env] of Object.entries({production:{VERCEL_ENV:'production'},development:{VERCEL_ENV:'development'},branch:{VERCEL_GIT_COMMIT_REF:'rebuild-nextjs'},project:{NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'},missingMap:{RC_QA_DELETION_TARGETS:undefined},badMap:{RC_QA_DELETION_TARGETS:'{'},arrayMap:{RC_QA_DELETION_TARGETS:'[]'},invalidProfile:{RC_QA_DELETION_TARGETS:JSON.stringify({[requestId]:'bad'})},tooMany:{RC_QA_DELETION_TARGETS:JSON.stringify(Object.fromEntries([1,2,3,4].map(n=>[`0000000${n}-1111-4111-8111-111111111111`,profileId])))}})){
 test(`scoped request denies ${name} without workers`,async()=>{const h=harness({env});assert.equal((await h.run()).status,404);noWorkers(h.calls);});
}
for(const search of ['',`?qa=0&requestId=${requestId}`,`?qa=1&requestId=${requestId}&extra=1`,`?qa=1&qa=1&requestId=${requestId}`,`?qa=1&requestId=${otherId}`,`?qa=1`,`?requestId=${requestId}`]){
 test(`invalid scoped URL never falls through: ${search||'bare'}`,async()=>{const h=harness();assert.equal((await h.run(search)).status,404);noWorkers(h.calls);});
}
test('missing and incorrect maintenance credentials deny before data reads',async()=>{
 for(const options of [{env:{CRON_SECRET:undefined}},{}]){const h=harness(options);const response=await h.run(undefined,'Bearer wrong');assert.ok([401,503].includes(response.status));noWorkers(h.calls);assert.deepEqual(h.calls.reads,[]);}
});
for(const row of [null,{id:requestId,status:'requested',profile_id:otherId,target_profile_id:profileId},{id:requestId,status:'processing',profile_id:null,target_profile_id:otherId},{id:requestId,status:'requested',profile_id:null,target_profile_id:null}]){
 test(`missing/mismatched row denies: ${JSON.stringify(row)}`,async()=>{const h=harness({row});assert.equal((await h.run()).status,404);noWorkers(h.calls);});
}
test('detached in-progress target uses persisted target identity',async()=>{
 const h=harness({row:{id:requestId,status:'processing',profile_id:null,target_profile_id:profileId}});assert.equal((await h.run()).status,200);assert.deepEqual(h.calls.processed,[requestId]);assert.equal(h.calls.queue,0);assert.equal(h.calls.images,0);
});
test('multiple configured fixtures select only the requested pair',async()=>{
 const h=harness({env:{RC_QA_DELETION_TARGETS:JSON.stringify({[requestId]:profileId,[otherId]:otherId})},row:{id:otherId,status:'requested',profile_id:otherId,target_profile_id:null}});
 assert.equal((await h.run(`?qa=1&requestId=${otherId}`)).status,200);
 assert.deepEqual(h.calls.processed,[otherId]);assert.equal(h.calls.queue,0);assert.equal(h.calls.images,0);
});
test('completed scrubbed request is idempotent without workers',async()=>{
 const h=harness({row:{id:requestId,status:'completed',profile_id:null,target_profile_id:null}});const response=await h.run();assert.equal(response.status,200);assert.equal((await response.json()).result.reason,'already_completed');noWorkers(h.calls);
});
test('scoped read and processor failures never fall through or disclose upstream detail',async()=>{
 for(const options of [{readError:{message:'private upstream detail'}},{workerError:true}]){const h=harness(options);const response=await h.run();assert.equal(response.status,500);assert.equal(h.calls.queue,0);assert.equal(h.calls.images,0);assert.equal(h.calls.alerts,0);assert.ok(!(await response.text()).includes('private upstream detail'));}
});
test('ordinary unconfigured no-query maintenance preserves existing queue behavior',async()=>{
 const h=harness({env:{RC_QA_DELETION_TARGETS:undefined,VERCEL_ENV:'production'}});assert.equal((await h.run('')).status,200);assert.equal(h.calls.queue,1);assert.equal(h.calls.images,1);assert.deepEqual(h.calls.processed,[]);
});
