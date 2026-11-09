import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("mobile listing GET and question routes share one Next.js dynamic segment name", async () => {
  const question = await readFile("src/app/api/mobile/v1/listings/[slug]/question/route.ts", "utf8");

  assert.match(question, /params:Promise<\{slug:string\}>/);
  assert.match(question, /const \{slug:partId\}=await params/);
  assert.match(question, /isUuid\(partId\)/);
  assert.match(question, /p_part_id:partId/);
});

const source=await readFile("src/app/api/mobile/v1/listings/[slug]/question/route.ts","utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function handler({signedIn=true}={}){
 const calls={auth:0,rpc:[],dispatch:0};
 const exports={};
 vm.runInNewContext(compiled,{exports,require(name){
  if(name==="@/lib/identifiers")return {isUuid:value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)};
  if(name==="@/lib/push/schedule")return {schedulePushDispatch(){calls.dispatch++;}};
  if(name==="@/lib/mobile-api")return {
   mobileOptions(){},mobileJson:(_request,body,status)=>({body,status}),
   async requireMobileUser(){calls.auth++;return signedIn?{context:{supabase:{async rpc(name,args){calls.rpc.push({name,args});return {data:"conversation_owned",error:null};}}}}:{response:{status:401}};}
  };
  throw new Error("Unexpected dependency "+name);
 }});
 return {post:exports.POST,calls};
}
const partId="a1234567-1234-4123-8123-123456789abc";
test("question route preserves UUID contract despite sharing the slug-named directory",async()=>{
 const {post,calls}=handler();
 const response=await post(new Request("https://qa.invalid",{method:"POST",body:JSON.stringify({body:"QA part question"})}),{params:Promise.resolve({slug:partId})});
 assert.equal(response.status,201);
 assert.equal(response.body.conversationId,"conversation_owned");
 assert.equal(JSON.stringify(calls.rpc),JSON.stringify([{name:"start_listing_conversation",args:{p_part_id:partId,p_body:"QA part question"}}]));
 assert.equal(calls.dispatch,1);
});
test("human slug is rejected before authentication or database access",async()=>{
 const {post,calls}=handler();
 const response=await post(new Request("https://qa.invalid",{method:"POST"}),{params:Promise.resolve({slug:"part-slug"})});
 assert.equal(response.status,400);
 assert.equal(calls.auth,0);assert.equal(calls.rpc.length,0);assert.equal(calls.dispatch,0);
});
test("anonymous question cannot invoke privileged conversation work",async()=>{
 const {post,calls}=handler({signedIn:false});
 const response=await post(new Request("https://qa.invalid",{method:"POST"}),{params:Promise.resolve({slug:partId})});
 assert.equal(response.status,401);assert.equal(calls.rpc.length,0);assert.equal(calls.dispatch,0);
});
