import assert from "node:assert/strict";
import {File} from "node:buffer";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";

function load(source,dependencies){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(source,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,Buffer,File,require(name){if(name in dependencies)return dependencies[name];throw Error(name);}});
 return exports;
}
const validator=load("src/lib/image-upload.ts",{"server-only":{},sharp});

test("corrupt second evidence image rejects the whole selection before Storage/RPC writes",async()=>{
 let writes=0;
 const supabase={storage:{from(){return {upload:async()=>{writes++;return {error:null};}};}},rpc:async()=>{writes++;return {error:null};}};
 const actions=load("src/app/cases/evidence-actions.ts",{
  "node:crypto":{randomUUID:()=>"fixture"},"next/cache":{revalidatePath(){}},
  "@/lib/auth":{requireUser:async()=>({id:"qa-user"})},
  "@/lib/case-evidence-cleanup":{cleanupFailedCaseEvidenceUpload:async()=>{}},
  "@/lib/image-upload":validator,"@/lib/supabase/server":{createSupabaseServerClient:async()=>supabase}
 });
 const valid=await sharp({create:{width:2,height:2,channels:3,background:"white"}}).png().toBuffer();
 const files=[new File([valid],"valid.png",{type:"image/png"}),new File([new Uint8Array([0xff,0xd8,0xff])],"broken.jpg",{type:"image/jpeg"})];
 const result=await actions.uploadCaseEvidence({}, {get:()=>"qa-case",getAll:()=>files});
 assert.equal(result.status,"error");
 assert.match(result.message,/valid.*image/i);
 assert.equal(writes,0);
});

test("mobile case evidence rejects signature-only content before Storage/RPC writes",async()=>{
 let writes=0;
 const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:"qa-case",status:"open"},error:null}),then(resolve){return Promise.resolve({count:0,error:null}).then(resolve);}};
 const supabase={from:()=>query,storage:{from(){return {upload:async()=>{writes++;return {error:null};}};}},rpc:async()=>{writes++;return {error:null,data:"qa-evidence"};}};
 const route=load("src/app/api/mobile/v1/cases/[caseId]/evidence/route.ts",{
  "node:crypto":{randomUUID:()=>"fixture"},"@/lib/identifiers":{isUuid:()=>true},
  "@/lib/case-evidence-cleanup":{cleanupFailedCaseEvidenceUpload:async()=>{}},
  "@/lib/image-upload":validator,
  "@/lib/mobile-api":{mobileOptions(){},mobileJson(_request,body,status){return {body,status};},requireMobileUser:async()=>({context:{user:{id:"qa-user"},supabase}})}
 });
 const file=new File([new Uint8Array([0xff,0xd8,0xff])],"broken.jpg",{type:"image/jpeg"});
 const response=await route.POST({formData:async()=>({get:()=>file})},{params:Promise.resolve({caseId:"qa-case"})});
 assert.equal(response.status,400);
 assert.equal(response.body.error,"invalid_image");
 assert.equal(writes,0);
});
