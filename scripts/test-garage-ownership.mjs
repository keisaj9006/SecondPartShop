import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function actions({authenticated=true}={}){
 const writes=[],filters=[],revalidated=[];
 const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},then(resolve){return Promise.resolve({data:[]}).then(resolve);},insert(value){writes.push(value);return Promise.resolve({error:null});},delete(){writes.push("delete");return this;}};
 const exports={};
 const source=fs.readFileSync(new URL("../src/app/garage/actions.ts",import.meta.url),"utf8");
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require(name){
  if(name==="next/cache")return {revalidatePath:value=>revalidated.push(value)};
  if(name==="@/lib/auth")return {requireUser:async()=>{if(!authenticated)throw Error("Sign in required");return {id:"current-user"};}};
  if(name==="@/lib/data/vehicle-catalogue")return {getCatalogueSelection:async()=>({fuelType:"PETROL",engineSizeSimple:1596})};
  if(name==="@/lib/supabase/server")return {createSupabaseServerClient:async()=>({from:()=>query})};
  if(name==="@/lib/vehicle-registration")return {normalizeRegistration:value=>value.trim().toUpperCase().replace(/\s/g,""),isPlausibleUkRegistration:value=>/^[A-Z0-9]{2,8}$/.test(value)};
  throw Error(name);
 }});
 return {...exports,writes,filters,revalidated};
}

test("Garage save uses authenticated owner and catalogue fields after explicit submission",async()=>{
 const subject=actions(),form=new FormData();
 for(const [key,value] of Object.entries({variantId:"variant-focus",year:"2012",registration:"ab12 cde",profile_id:"another-user",fuel:"PETROL",engine:"1596"}))form.set(key,value);
 await subject.saveGarageVehicle(form);
 assert.equal(subject.writes.length,1);
 assert.equal(subject.writes[0].profile_id,"current-user");
 assert.equal(subject.writes[0].registration,"AB12CDE");
 assert.equal(subject.writes[0].engine_size_simple,1596);
 assert.ok(subject.filters.some(([key,value])=>key==="profile_id"&&value==="current-user"));
 assert.ok(subject.revalidated.includes("/garage"));
});

test("deleting a supplied Garage id is scoped to the authenticated owner",async()=>{
 const subject=actions(),form=new FormData();form.set("id","other-users-vehicle");
 await subject.removeGarageVehicle(form);
 assert.deepEqual(subject.filters,[["id","other-users-vehicle"],["profile_id","current-user"]]);
});

test("unauthenticated Garage save and delete cannot reach database writes",async()=>{
 const subject=actions({authenticated:false});
 await assert.rejects(subject.saveGarageVehicle(new FormData()),/Sign in required/);
 await assert.rejects(subject.removeGarageVehicle(new FormData()),/Sign in required/);
 assert.equal(subject.writes.length,0);
});
