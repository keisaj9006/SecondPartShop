import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source=ts.transpileModule(fs.readFileSync("src/app/api/mobile/v1/vehicle-lookup/route.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function routeModule(rateResult,{catalogueError=false}={}){
 const exports={};
 let providerCalls=0;
 const logs=[];
 vm.runInNewContext(source,{
  exports,
  require(name){
   if(name==="@/lib/vehicle-lookup-operational")return {consumeVehicleLookupRateLimit:async()=>rateResult};
   if(name==="@/lib/vehicle-registration")return {
    normalizeRegistration:value=>String(value).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8),
    isPlausibleUkRegistration:value=>value==="AB12CDE",
    lookupVehicleByRegistration:async()=>{providerCalls++;return {status:"found",registration:"AB12CDE",vehicle:{make:"FORD",model:"FOCUS",year:2020}};}
   };
   if(name==="node:crypto")return crypto;
   if(name==="@/lib/data/vehicle-catalogue")return {matchRegistrationToCatalogue:async()=>{if(catalogueError)throw new Error("synthetic-secret AB12CDE");return {variants:[]};}};
   if(name==="@/lib/mobile-api")return {
    mobileJson:(_request,body,status=200)=>({body,status}),
    mobileOptions:()=>({status:204})
   };
   throw new Error(`Unexpected dependency ${name}`);
  },
  Request,Response,Headers,URL,URLSearchParams,String,Object,Array,JSON,Math,console:{error:(...args)=>logs.push(args)}
 });
 return {POST:exports.POST,providerCalls:()=>providerCalls,logs};
}

const request=()=>new Request("https://secondpart.test/api/mobile/v1/vehicle-lookup",{
 method:"POST",
 headers:{"content-type":"application/json"},
 body:JSON.stringify({registration:"AB12CDE"})
});

test("mobile lookup treats a failed operational guard as 503, not quota exhaustion",async()=>{
 const route=routeModule({status:"unavailable",allowed:false,remaining:null,retryAfterSeconds:0});
 const response=await route.POST(request());
 assert.equal(response.status,503);
 assert.equal(response.body.error,"lookup_guard_unavailable");
 assert.equal(route.providerCalls(),0);
});

test("mobile lookup preserves a real quota exhaustion as 429",async()=>{
 const route=routeModule({status:"available",allowed:false,remaining:0,retryAfterSeconds:37});
 const response=await route.POST(request());
 assert.equal(response.status,429);
 assert.equal(response.body.error,"rate_limited");
 assert.equal(response.body.retryAfterSeconds,37);
 assert.equal(route.providerCalls(),0);
});

test("mobile catalogue failure emits a safe catalogue_error diagnostic",async()=>{
 const route=routeModule({status:"available",allowed:true,remaining:29,retryAfterSeconds:0},{catalogueError:true});
 const response=await route.POST(request());
 assert.equal(response.status,503);
 assert.equal(route.logs.length,1);
 assert.equal(route.logs[0][0],"vehicle_lookup_failed");
 assert.equal(route.logs[0][1].code,"catalogue_error");
 assert.equal(route.logs[0][1].stage,"catalogue");
 assert.equal(route.logs[0][1].registration_hash,"63c9b47c5f01bba3341c2165b5ae0b3ace9398e91f130566bfa6225045f8b7d1");
 assert.doesNotMatch(JSON.stringify(route.logs),/AB12CDE|synthetic-secret/);
});
