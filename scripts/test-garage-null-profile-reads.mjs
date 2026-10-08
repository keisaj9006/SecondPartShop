import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const rows=[
 {id:'legacy',catalogue_variant_id:'variant',registration:null,year:2016,fuel_type:'PETROL',engine_size_simple:1300,colour:null,nickname:null,created_at:'2026-01-01',identity_make:null,identity_model:null,vehicle_catalogue_variants:{make:'HONDA',model_family:'JAZZ',variant:'SE'}},
 {id:'identity',catalogue_variant_id:null,registration:'AB16CDE',year:2016,fuel_type:'DIESEL',engine_size_simple:1600,colour:'GREY',nickname:null,created_at:'2026-01-02',identity_make:'RENAULT',identity_model:'TRAFIC',vehicle_catalogue_variants:null}
];
function load(path,modules){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL,Request,require(name){if(name in modules)return modules[name];throw Error(name);}});
 return exports;
}
function db(){
 const filters=[];
 const query={select(columns){assert.ok(!columns.includes('!inner'),'identity rows must survive joins');return this;},eq(k,v){filters.push([k,v]);return this;},order(){return this;},range(){return Promise.resolve({data:rows,error:null});},maybeSingle(){return Promise.resolve({data:rows[1],error:null});}};
 return {from(){return query;},filters};
}
test('web Garage page retains both legacy and identity-only rows with truthful null profile',async()=>{
 const database=db(),subject=load('src/lib/data/garage.ts',{'server-only':{},'@/lib/supabase/server':{createSupabaseServerClient:async()=>database},'@/lib/supabase/env':{isSupabaseConfigured:()=>true}});
 const page=await subject.getGarageVehiclesPage('owner');
 assert.equal(page.items.length,2);assert.equal(page.items[0].make,'HONDA');assert.equal(page.items[1].model,'TRAFIC');assert.equal(page.items[1].catalogueVariantId,null);assert.equal(page.items[1].variant,null);
 const vehicle=await subject.getGarageVehicleById('owner','identity');
 assert.equal(vehicle.id,'identity');assert.ok(database.filters.some(([k,v])=>k==='profile_id'&&v==='owner'));assert.ok(database.filters.some(([k,v])=>k==='id'&&v==='identity'));
});
test('mobile Garage projection retains identity-only snapshots',async()=>{
 const database=db(),subject=load('src/app/api/mobile/v1/garage/route.ts',{'@/lib/garage-save':{},'@/lib/identifiers':{},'@/lib/mobile-api':{requireMobileUser:async()=>({context:{user:{id:'owner'},supabase:database}}),mobileJson:(_r,data)=>data}});
 const result=await subject.GET(new Request('https://example.test/api/mobile/v1/garage'));
 assert.equal(result.items.length,2);assert.equal(result.items[1].make,'RENAULT');assert.equal(result.items[1].model,'TRAFIC');assert.equal(result.items[1].variant,null);
});
