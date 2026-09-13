import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile=path=>ts.transpileModule(fs.readFileSync(path,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

const request=()=>new Request("https://secondpart.test/api/vehicle-lookup",{
 method:"POST",
 headers:{"content-type":"application/json","x-forwarded-for":"198.51.100.10","user-agent":"SecondPart RC test"},
 body:JSON.stringify({registration:"AB12CDE"})
});

function operationalModule(rpcMode){
 const source=compile("src/lib/vehicle-lookup-operational.ts");
 const exports={};
 const query={
  select(){return query;},eq(){return query;},gt(){return query;},maybeSingle:async()=>({data:null,error:null}),upsert:async()=>({error:null})
 };
 const admin={
  from(){return query;},
  async rpc(){
   if(rpcMode==="throw")throw new Error("synthetic limiter transport failure");
   if(rpcMode==="error")return {data:null,error:{message:"synthetic limiter database failure"}};
   if(rpcMode==="missing")return {data:[],error:null};
   if(rpcMode==="limited")return {data:[{allowed:false,remaining:0,retry_after_seconds:37}],error:null};
   return {data:[{allowed:true,remaining:29,retry_after_seconds:0}],error:null};
  }
 };
 vm.runInNewContext(source,{
  exports,
  require(name){
   if(name==="server-only")return {};
   if(name==="node:crypto")return require("node:crypto");
   if(name==="@/lib/supabase/admin")return {createSupabaseAdminClient:()=>admin};
   if(name==="@/lib/vehicle-registration")return {};
   throw new Error(`Unexpected dependency ${name}`);
  },
  Date,Number,Boolean,Record,Object,Array,Promise
 });
 return exports;
}

function routeModule(rateResult){
 const source=compile("src/app/api/vehicle-lookup/route.ts");
 const exports={};
 let providerCalls=0;
 let catalogueCalls=0;
 class TestNextResponse{
  static json(body,{status=200,headers={}}={}){
   return {status,body,headers:new Headers(headers),json:async()=>body};
  }
 }
 vm.runInNewContext(source,{
  exports,
  require(name){
   if(name==="next/server")return {NextResponse:TestNextResponse};
   if(name==="@/lib/vehicle-lookup-operational")return {consumeVehicleLookupRateLimit:async()=>rateResult};
   if(name==="@/lib/vehicle-registration")return {
    normalizeRegistration:value=>String(value).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8),
    isPlausibleUkRegistration:value=>value==="AB12CDE",
    lookupVehicleByRegistration:async()=>{
     providerCalls++;
     return {status:"found",registration:"AB12CDE",vehicle:{make:"FORD",model:"FOCUS",year:2020}};
    }
   };
   if(name==="@/lib/data/vehicle-catalogue")return {matchRegistrationToCatalogue:async()=>{catalogueCalls++;return {variants:[]};}};
   throw new Error(`Unexpected dependency ${name}`);
  },
  Request,Response,Headers,URL,URLSearchParams,String,Object,Array,JSON,Math
 });
 return {POST:exports.POST,stats:()=>({providerCalls,catalogueCalls})};
}

for(const mode of ["error","missing","throw"]){
 test(`limiter ${mode} fails closed instead of granting an official lookup`,async()=>{
  const result=await operationalModule(mode).consumeVehicleLookupRateLimit(request());
  assert.equal(result.status,"unavailable");
  assert.equal(result.allowed,false);
  assert.equal(result.remaining,null);
 });
}

test("normal quota exhaustion remains distinct from limiter unavailability",async()=>{
 const result=await operationalModule("limited").consumeVehicleLookupRateLimit(request());
 assert.equal(result.status,"available");
 assert.equal(result.allowed,false);
 assert.equal(result.remaining,0);
 assert.equal(result.retryAfterSeconds,37);
});

test("healthy limiter permits normal lookup",async()=>{
 const result=await operationalModule("allowed").consumeVehicleLookupRateLimit(request());
 assert.equal(result.status,"available");
 assert.equal(result.allowed,true);
 assert.equal(result.remaining,29);
});

for(const label of ["database error","missing limiter row","limiter exception"]){
 test(`${label} returns temporary-unavailable guidance with zero provider calls`,async()=>{
  const route=routeModule({status:"unavailable",allowed:false,remaining:null,retryAfterSeconds:0});
  const response=await route.POST(request());
  assert.equal(response.status,503);
  assert.equal(response.body.code,"vehicle_lookup_guard_unavailable");
  assert.match(response.body.message,/choose the vehicle manually/i);
  assert.deepEqual(route.stats(),{providerCalls:0,catalogueCalls:0});
 });
}

test("real quota exhaustion stays 429 and never reaches the provider",async()=>{
 const route=routeModule({status:"available",allowed:false,remaining:0,retryAfterSeconds:37});
 const response=await route.POST(request());
 assert.equal(response.status,429);
 assert.equal(response.body.code,"vehicle_lookup_rate_limited");
 assert.equal(response.headers.get("retry-after"),"37");
 assert.deepEqual(route.stats(),{providerCalls:0,catalogueCalls:0});
});

test("only a healthy allowed limiter reaches provider and catalogue lookup",async()=>{
 const route=routeModule({status:"available",allowed:true,remaining:29,retryAfterSeconds:0});
 const response=await route.POST(request());
 assert.equal(response.status,200);
 assert.deepEqual(route.stats(),{providerCalls:1,catalogueCalls:1});
});
