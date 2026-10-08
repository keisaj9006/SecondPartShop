import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function actions({authenticated=true}={}){
 const writes=[],filters=[],revalidated=[];
 const query={eq(key,value){filters.push([key,value]);return this;},select(){return this;},maybeSingle:async()=>({data:{id:"other-users-vehicle"},error:null}),then(resolve){return Promise.resolve({data:[]}).then(resolve);},delete(){writes.push("delete");return this;}};
 const database={from:()=>query,rpc:async(name,args)=>{assert.equal(name,'save_garage_vehicle_v1');writes.push(args);return {data:[{garage_vehicle_id:'saved',outcome:'created',catalogue_variant_id:args.p_catalogue_variant_id}],error:null};}};
 function load(path){const exports={};const source=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Request,FormData,require(name){
  if(name==='server-only')return {};
  if(name==='next/headers')return {headers:async()=>new Headers()};
  if(name==='@/lib/garage-save')return load('src/lib/garage-save.ts');
  if(name==='@/lib/identifiers')return {isUuid:value=>/^[0-9a-f-]{36}$/.test(value)};
  if(name==='@/lib/vehicle-lookup-operational')return {consumeVehicleLookupRateLimit:async()=>({status:'available',allowed:true})};
  if(name==="next/cache")return {revalidatePath:value=>revalidated.push(value)};
  if(name==="@/lib/auth")return {requireUser:async()=>{if(!authenticated)throw Error("Sign in required");return {id:"current-user"};}};
  if(name==="@/lib/data/vehicle-catalogue")return {getCatalogueSelection:async()=>({make:'FORD',modelFamily:'FOCUS',fuelType:"PETROL",engineSizeSimple:1596})};
  if(name==="@/lib/supabase/server")return {createSupabaseServerClient:async()=>database};
  if(name==="@/lib/vehicle-registration")return {normalizeRegistration:value=>value.trim().toUpperCase().replace(/\s/g,""),isPlausibleUkRegistration:value=>/^[A-Z0-9]{2,8}$/.test(value)};
  throw Error(name);
 }});return exports;}
 return {...load('src/app/garage/actions.ts'),writes,filters,revalidated};
}

test("Garage save uses authenticated owner and catalogue fields after explicit submission",async()=>{
 const subject=actions(),form=new FormData();
 for(const [key,value] of Object.entries({variantId:"72000000-0000-4000-8000-000000000010",year:"2012",registration:"ab12 cde",profile_id:"another-user",fuel:"PETROL",engine:"1596"}))form.set(key,value);
 await subject.saveGarageVehicle(form);
 assert.equal(subject.writes.length,1);
 assert.ok(!('p_profile_id' in subject.writes[0]),'owner is derived inside the authenticated RPC');
 assert.equal(subject.writes[0].p_registration,"AB12CDE");
 assert.equal(subject.writes[0].p_engine,1596);
 assert.ok(subject.revalidated.includes("/garage"));
});

test("deleting a supplied Garage id is scoped to the authenticated owner",async()=>{
 const subject=actions(),form=new FormData();form.set("id","other-users-vehicle");
 assert.equal((await subject.removeGarageVehicle(form)).ok,true);
 assert.deepEqual(subject.filters,[["id","other-users-vehicle"],["profile_id","current-user"]]);
});

test("unauthenticated Garage save and delete cannot reach database writes",async()=>{
 const subject=actions({authenticated:false});
 await assert.rejects(subject.saveGarageVehicle(new FormData()),/Sign in required/);
 await assert.rejects(subject.removeGarageVehicle(new FormData()),/Sign in required/);
 assert.equal(subject.writes.length,0);
});
