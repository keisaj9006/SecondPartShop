import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const caseId="11111111-1111-4111-8111-111111111111";
const userId="22222222-2222-4222-8222-222222222222";
const generated="33333333-3333-4333-8333-333333333333";
const storagePath=`${caseId}/${userId}/${generated}.jpg`;
const migrationPath="supabase/migrations/20260918154500_case_evidence_cleanup_outbox.sql";

function load(path,deps,extra={}){
 const exports={};
 const source=fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const code=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 vm.runInNewContext(code,{
  exports,
  require:name=>{
   if(name in deps)return deps[name];
   if(name==="server-only")return {};
   throw new Error("Unexpected dependency "+name+" in "+path);
  },
  console,
  process:{env:{}},
  URL,
  FormData,
  File,
  Request,
  Response,
  Uint8Array,
  ...extra
 });
 return exports;
}

test("case evidence cleanup migration defines a service-only durable outbox",()=>{
 assert.ok(fs.existsSync(migrationPath),"expected case evidence cleanup migration");
 const sql=fs.readFileSync(migrationPath,"utf8");
 assert.match(sql,/create table private\.case_evidence_cleanup/i);
 assert.match(sql,/queue_orphan_case_evidence_cleanup/i);
 assert.match(sql,/get_case_evidence_cleanup_queue/i);
 assert.match(sql,/complete_case_evidence_cleanup/i);
 assert.match(sql,/fail_case_evidence_cleanup/i);
 assert.match(sql,/participant\.buyer_id\s+is\s+distinct\s+from\s+p_uploader_id/i);
 assert.match(sql,/participant\.owner_id\s+is\s+distinct\s+from\s+p_uploader_id/i);
 assert.match(sql,/transaction_case_evidence/i);
 assert.match(sql,/grant execute on function public\.queue_orphan_case_evidence_cleanup[\s\S]*?to service_role/i);
 assert.doesNotMatch(sql,/grant execute on function public\.queue_orphan_case_evidence_cleanup[\s\S]*?to authenticated/i);
});

function cleanupHarness({queueError=null,queueData=true,rows=[{storage_path:storagePath}],storageError=null,completeError=null}={}){
 const events=[];
 const warnings=[];
 const admin={
  rpc:async(name,args)=>{
   events.push(["rpc",name,args]);
   if(name==="queue_orphan_case_evidence_cleanup")return {data:queueData,error:queueError};
   if(name==="get_case_evidence_cleanup_queue")return {data:rows,error:null};
   if(name==="complete_case_evidence_cleanup")return {data:!completeError,error:completeError};
   if(name==="fail_case_evidence_cleanup")return {data:null,error:null};
   throw new Error("Unexpected RPC "+name);
  },
  storage:{
   from(bucket){
    assert.equal(bucket,"case-evidence");
    return {
     async remove(paths){
      events.push(["remove",...paths]);
      return {error:storageError};
     }
    };
   }
  }
 };
 const api=load("src/lib/case-evidence-cleanup.ts",{
  "@/lib/supabase/admin":{createSupabaseAdminClient:()=>admin},
  "@/lib/ops-monitoring":{reportOperationalWarning(payload){warnings.push(payload);}}
 });
 return {api,events,warnings};
}

test("durable cleanup is queued before exact-path Storage removal",async()=>{
 const h=cleanupHarness();
 assert.equal(await h.api.cleanupFailedCaseEvidenceUpload(userId,caseId,storagePath),true);
 const queueIndex=h.events.findIndex(e=>e[0]==="rpc"&&e[1]==="queue_orphan_case_evidence_cleanup");
 const removeIndex=h.events.findIndex(e=>e[0]==="remove");
 const completeIndex=h.events.findIndex(e=>e[0]==="rpc"&&e[1]==="complete_case_evidence_cleanup");
 assert.ok(queueIndex>=0&&removeIndex>queueIndex&&completeIndex>removeIndex,JSON.stringify(h.events));
});

test("attached path refusal never removes Storage bytes",async()=>{
 const h=cleanupHarness({queueData:false});
 assert.equal(await h.api.cleanupFailedCaseEvidenceUpload(userId,caseId,storagePath),true);
 assert.equal(h.events.some(e=>e[0]==="remove"),false);
});

test("pre-migration PGRST202 keeps the current exact-path cleanup fallback",async()=>{
 const h=cleanupHarness({
  queueError:{code:"PGRST202",message:"Could not find the function"},
  rows:[]
 });
 assert.equal(await h.api.cleanupFailedCaseEvidenceUpload(userId,caseId,storagePath),true);
 assert.equal(h.events.filter(e=>e[0]==="remove").length,1);
});

test("invalid cleanup path is never removed even when queueing is unavailable",async()=>{
 const h=cleanupHarness({queueError:{code:"PGRST202",message:"missing"},rows:[]});
 assert.equal(await h.api.cleanupFailedCaseEvidenceUpload(userId,caseId,"victim/arbitrary.jpg"),false);
 assert.equal(h.events.some(e=>e[0]==="remove"),false);
});

test("uncertain queue failure never removes Storage bytes",async()=>{
 const h=cleanupHarness({queueError:{code:"PGRST001",message:"database unavailable"}});
 assert.equal(await h.api.cleanupFailedCaseEvidenceUpload(userId,caseId,storagePath),false);
 assert.equal(h.events.some(e=>e[0]==="remove"),false,"Uncertain queue outcome must fail closed on Storage deletion.");
 assert.equal(h.warnings.some(w=>w.event==="case_evidence_cleanup_queue_failed"),true);
});

test("ambiguous empty queue response never removes Storage bytes",async()=>{
 const h=cleanupHarness({queueData:null});
 assert.equal(await h.api.cleanupFailedCaseEvidenceUpload(userId,caseId,storagePath),false);
 assert.equal(h.events.some(e=>e[0]==="remove"),false,"Null queue result is not cleanup authority.");
 assert.equal(h.warnings.some(w=>w.event==="case_evidence_cleanup_queue_uncertain"),true);
});

test("worker leaves failed Storage cleanup queued for retry",async()=>{
 const h=cleanupHarness({storageError:{message:"storage failed"}});
 const result=await h.api.processCaseEvidenceCleanup(50);
 assert.equal(result.failed,1);
 assert.equal(h.events.some(e=>e[0]==="rpc"&&e[1]==="fail_case_evidence_cleanup"),true);
 assert.equal(h.events.some(e=>e[0]==="rpc"&&e[1]==="complete_case_evidence_cleanup"),false);
 assert.equal(h.warnings.some(w=>w.event==="case_evidence_cleanup_pending"),true);
});

test("worker treats missing cleanup RPC as a staged rollout skip",async()=>{
 const events=[];
 const api=load("src/lib/case-evidence-cleanup.ts",{
  "@/lib/supabase/admin":{
   createSupabaseAdminClient:()=>({
    rpc:async(name,args)=>{
     events.push([name,args]);
     return {data:null,error:{code:"PGRST202",message:"Could not find the function"}};
    },
    storage:{from(){throw new Error("Storage must not be touched");}}
   })
  },
  "@/lib/ops-monitoring":{reportOperationalWarning(){}}
 });
 const result=await api.processCaseEvidenceCleanup(50);
 assert.equal(result.skipped,true);
});

function webUploadHarness(){
 const cleanupCalls=[];
 const directRemoves=[];
 const supabase={
  storage:{from:()=>({
   upload:async()=>({error:null}),
   remove:async paths=>{directRemoves.push(paths);return {error:null};}
  })},
  rpc:async name=>name==="register_transaction_case_evidence"
   ?{data:null,error:{message:"attach failed"}}
   :{data:null,error:null}
 };
 const api=load("src/app/cases/evidence-actions.ts",{
  "node:crypto":{randomUUID:()=>generated},
  "next/cache":{revalidatePath(){}},
  "@/lib/auth":{requireUser:async()=>({id:userId})},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>supabase},
  "@/lib/supabase/admin":{createSupabaseAdminClient:()=>({storage:supabase.storage})},
  "@/lib/case-evidence-cleanup":{
   cleanupFailedCaseEvidenceUpload:async(...args)=>{cleanupCalls.push(args);return true;}
  }
 });
 return {api,cleanupCalls,directRemoves};
}

test("web evidence registration failure delegates orphan handling to durable cleanup helper",async()=>{
 const h=webUploadHarness();
 const form=new FormData();
 form.set("caseId",caseId);
 form.set("evidence",new File(["photo"],"evidence.jpg",{type:"image/jpeg"}));
 const result=await h.api.uploadCaseEvidence({},form);
 assert.equal(result.status,"error");
 assert.equal(h.cleanupCalls.length,1);
 assert.deepEqual(h.cleanupCalls[0],[userId,caseId,storagePath]);
 assert.equal(h.directRemoves.length,0);
});

function mobileUploadHarness(){
 const cleanupCalls=[];
 const directRemoves=[];
 const supabase={
  from(table){
   if(table==="transaction_cases")return {
    select(){return this;},eq(){return this;},
    async maybeSingle(){return {data:{id:caseId,status:"open"},error:null};}
   };
   if(table==="transaction_case_evidence")return {
    select(){return this;},eq(){return this;},
    then(resolve){resolve({count:0,error:null});}
   };
   throw new Error("Unexpected table "+table);
  },
  storage:{from:()=>({
   upload:async()=>({error:null}),
   remove:async paths=>{directRemoves.push(paths);return {error:null};}
  })},
  rpc:async name=>name==="register_transaction_case_evidence"
   ?{data:null,error:{message:"attach failed"}}
   :{data:null,error:null}
 };
 const api=load("src/app/api/mobile/v1/cases/[caseId]/evidence/route.ts",{
  "node:crypto":{randomUUID:()=>generated},
  "@/lib/identifiers":{isUuid:()=>true},
  "@/lib/mobile-api":{
   mobileOptions(){return new Response(null,{status:204});},
   mobileJson(_request,payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json"}});},
   requireMobileUser:async()=>({context:{user:{id:userId},supabase}})
  },
  "@/lib/supabase/admin":{createSupabaseAdminClient:()=>({storage:supabase.storage})},
  "@/lib/case-evidence-cleanup":{
   cleanupFailedCaseEvidenceUpload:async(...args)=>{cleanupCalls.push(args);return true;}
  }
 });
 return {api,cleanupCalls,directRemoves};
}

test("mobile evidence registration failure delegates orphan handling to durable cleanup helper",async()=>{
 const h=mobileUploadHarness();
 const form=new FormData();
 form.set("file",new File(["photo"],"evidence.jpg",{type:"image/jpeg"}));
 const request=new Request("https://secondpart.test/api/mobile/v1/cases/"+caseId+"/evidence",{method:"POST",body:form});
 const response=await h.api.POST(request,{params:Promise.resolve({caseId})});
 const body=await response.json();
 assert.equal(response.status,409);
 assert.equal(body.error,"evidence_attach_failed");
 assert.equal(h.cleanupCalls.length,1);
 assert.deepEqual(h.cleanupCalls[0],[userId,caseId,storagePath]);
 assert.equal(h.directRemoves.length,0);
});

test("commerce maintenance includes case evidence cleanup worker",()=>{
 const source=fs.readFileSync("src/app/api/commerce/maintenance/route.ts","utf8");
 assert.match(source,/processCaseEvidenceCleanup/);
 assert.match(source,/caseEvidenceCleanup/);
});
