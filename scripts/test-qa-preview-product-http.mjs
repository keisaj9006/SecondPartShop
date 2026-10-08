import assert from "node:assert/strict";
import test from "node:test";
import {validateConfig,createPreviewRequest,runPreviewProductQa} from "./qa-preview-product-http.mjs";
const input=()=>({authorization:"preview-disposable-fixtures",previewUrl:"https://second-part-shop-poxof2fu7-joannakwapis11-5369.vercel.app",supabaseUrl:"https://etkupijfdznljimrfyct.supabase.co",publicKey:"sb_publishable_fixture",runId:"rc26-hosted-20261008-autonomous",retainDisposableArtifacts:false,identities:{buyer:{id:"4514c0f5-3d57-419f-9c12-852273739b27",email:"rc26-hosted-20261008-autonomous-buyer@qa.secondpart.invalid",password:"fixture-password"},garage:{id:"c3004680-7cd8-418d-a79b-0c25faa3da6e",email:"rc26-hosted-20261008-autonomous-garage@qa.secondpart.invalid",password:"fixture-password"},stranger:{id:"7c7cad1e-9ed7-4afc-b2f4-00548554cf12",email:"rc26-hosted-20261008-autonomous-stranger@qa.secondpart.invalid",password:"fixture-password"}}});
test("Preview QA refuses owner identities and non-pinned hosts before requests",()=>{
 for(const mutate of [x=>x.previewUrl="https://secondpart.co.uk",x=>x.supabaseUrl="https://wrong.supabase.co",x=>x.identities.buyer.id="11111111-1111-4111-8111-111111111111",x=>x.authorization="",x=>x.publicKey="sb_secret_fixture"]){const config=input();mutate(config);assert.throws(()=>validateConfig(config),/configuration rejected/);}
 assert.equal(validateConfig(input()).retainDisposableArtifacts,false);
});
test("Preview QA does not forward cookies or tokens through redirects",async()=>{
 const requests=[],session={cookies:new Map([["sb-test-auth-token","private-cookie"]]),accessToken:"private-bearer"};
 const call=createPreviewRequest(validateConfig(input()),async(url,options)=>{requests.push({url,options});return new Response(null,{status:302,headers:{location:"https://attacker.invalid"}});});
 const result=await call("/api/mobile/v1/me",{session,mobile:true});
 assert.equal(result.status,302);assert.equal(requests.length,1);assert.equal(requests[0].options.redirect,"manual");
 assert.equal(requests[0].options.headers.get("authorization"),"Bearer private-bearer");
 assert.ok(requests[0].options.headers.get("cookie").includes("private-cookie"));
 assert.ok(!requests[0].url.includes("private-"));
 await assert.rejects(call("//attacker.invalid",{session}),/unsafe request/);
 await assert.rejects(call("/api/stripe/webhook",{session}),/unsafe request/);
 assert.equal(requests.length,1);
});

test("owner email or a different fixture run is rejected before any authentication request",async()=>{
 const originalFetch=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests+=1;throw new Error("Unexpected authentication request");};
 try{
  for(const mutate of [x=>x.identities.buyer.email="owner@example.test",x=>x.identities.garage.email=x.identities.buyer.email,x=>x.runId="different-run"]){
   const config=input();mutate(config);await assert.rejects(runPreviewProductQa(config),/configuration rejected/);
  }
  assert.equal(requests,0);
 }finally{globalThis.fetch=originalFetch;}
});

test("shared-host mutation runner is quarantined before authentication under rollback-only strategy",async()=>{
 const originalFetch=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests+=1;throw new Error("Unexpected network request");};
 try{
  await assert.rejects(runPreviewProductQa(input()),/quarantined.*rollback-only/i);
  assert.equal(requests,0);
 }finally{globalThis.fetch=originalFetch;}
});
