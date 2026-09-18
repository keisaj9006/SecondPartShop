import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compile=(path)=>ts.transpileModule(fs.readFileSync(new URL("../"+path,import.meta.url),"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

const rows=[
 {
  id:"ev-1",
  case_id:"case-1",
  uploader_profile_id:"user-1",
  storage_path:"case-1/user-1/a.jpg",
  original_name:"a.jpg",
  mime_type:"image/jpeg",
  created_at:"2026-09-18T10:00:00Z"
 },
 {
  id:"ev-2",
  case_id:"case-1",
  uploader_profile_id:"user-2",
  storage_path:"case-1/user-2/b.jpg",
  original_name:"b.jpg",
  mime_type:"image/jpeg",
  created_at:"2026-09-18T10:01:00Z"
 }
];

function webHarness({failIndex=1}={}){
 const exports={};
 const query={
  select(){return this;},
  in(){return this;},
  async order(){return {data:rows,error:null};}
 };
 const supabase={
  from(table){
   assert.equal(table,"transaction_case_evidence");
   return query;
  },
  storage:{
   from(bucket){
    assert.equal(bucket,"case-evidence");
    return {
     async createSignedUrl(path){
      const index=rows.findIndex(row=>row.storage_path===path);
      if(index===failIndex)return {data:null,error:new Error("storage unavailable")};
      return {data:{signedUrl:"https://signed.example/"+index},error:null};
     }
    };
   }
  }
 };
 vm.runInNewContext(compile("src/lib/data/case-evidence.ts"),{
  exports,
  console,
  Map,
  Set,
  Promise,
  process:{env:{}},
  require(name){
   if(name==="server-only")return {};
   if(name==="@/lib/supabase/server")return {async createSupabaseServerClient(){return supabase;}};
   if(name==="@/lib/data/reputation")return {async getPublicMemberProfileById(id){return {id,handle:"member",displayName:"Member"};}};
   throw new Error("Unexpected dependency "+name);
  }
 });
 return exports;
}

test("web case evidence fails closed when any signed URL cannot be created",async()=>{
 const api=webHarness({failIndex:1});
 await assert.rejects(
  api.getTransactionCaseEvidence(["case-1"]),
  /temporarily unavailable/i
 );
});

test("web case evidence still returns all rows when all signed URLs are available",async()=>{
 const api=webHarness({failIndex:-1});
 const result=await api.getTransactionCaseEvidence(["case-1"]);
 assert.equal(result.get("case-1").length,2);
 assert.equal(result.get("case-1")[0].signedUrl,"https://signed.example/0");
 assert.equal(result.get("case-1")[1].signedUrl,"https://signed.example/1");
});

function mobileHarness({signedUrlFailure=true}={}){
 const exports={};
 const caseQuery={
  select(){return this;},
  eq(){return this;},
  async maybeSingle(){return {data:{id:"case-1",status:"open"},error:null};}
 };
 const evidenceQuery={
  select(){return this;},
  eq(){return this;},
  async order(){return {data:[rows[0]],error:null};}
 };
 const supabase={
  from(table){
   if(table==="transaction_cases")return caseQuery;
   if(table==="transaction_case_evidence")return evidenceQuery;
   throw new Error("Unexpected table "+table);
  },
  storage:{
   from(bucket){
    assert.equal(bucket,"case-evidence");
    return {
     async createSignedUrl(){
      return signedUrlFailure
       ?{data:null,error:new Error("storage unavailable")}
       :{data:{signedUrl:"https://signed.example/0"},error:null};
     }
    };
   }
  }
 };
 vm.runInNewContext(compile("src/app/api/mobile/v1/cases/[caseId]/evidence/route.ts"),{
  exports,
  console,
  Request,
  Response,
  File:globalThis.File,
  FormData,
  Uint8Array,
  process:{env:{}},
  require(name){
   if(name==="node:crypto")return {randomUUID(){return "uuid-test";}};
   if(name==="@/lib/identifiers")return {isUuid(){return true;}};
   if(name==="@/lib/mobile-api")return {
    mobileOptions(){return new Response(null,{status:204});},
    mobileJson(_request,payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json"}});},
    async requireMobileUser(){return {context:{user:{id:"user-1"},supabase}};}
   };
   if(name==="@/lib/supabase/admin")return {createSupabaseAdminClient(){throw new Error("admin not expected in GET");}};
   if(name==="@/lib/case-evidence-cleanup")return {cleanupFailedCaseEvidenceUpload:async()=>true};
   throw new Error("Unexpected dependency "+name);
  }
 });
 return exports;
}

test("mobile case evidence returns 503 instead of a partial empty list when signed URL creation fails",async()=>{
 const api=mobileHarness({signedUrlFailure:true});
 const response=await api.GET(
  new Request("https://secondpart.test/api/mobile/v1/cases/case-1/evidence"),
  {params:Promise.resolve({caseId:"case-1"})}
 );
 const body=await response.json();
 assert.equal(response.status,503);
 assert.deepEqual(body,{ok:false,error:"evidence_url_unavailable"});
});

test("mobile case evidence keeps normal response when signed URL creation succeeds",async()=>{
 const api=mobileHarness({signedUrlFailure:false});
 const response=await api.GET(
  new Request("https://secondpart.test/api/mobile/v1/cases/case-1/evidence"),
  {params:Promise.resolve({caseId:"case-1"})}
 );
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.count,1);
 assert.equal(body.items.length,1);
 assert.equal(body.items[0].signedUrl,"https://signed.example/0");
});
