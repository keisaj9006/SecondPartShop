import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const source=fs.readFileSync(path.join(root,"src/lib/vehicle-context.ts"),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(compiled,{exports,URLSearchParams,URL,window:undefined});
const {setVehicleContext,resolveVehicleContext,VEHICLE_CONTEXT_PARAMS}=exports;
const GARAGE="11111111-1111-4111-8111-111111111111";
const VARIANT="33333333-3333-4333-8333-333333333333";

test("Garage activation atomically clears every competing manual and legacy vehicle parameter",()=>{
 const result=setVehicleContext(new URLSearchParams("q=alternator&gv="+GARAGE+"&cv="+VARIANT+"&cy=2020&cf=petrol&ce=1984&vehicle=legacy&vr=SE66PPO&vc=grey&fit=0"),{kind:"garage",garageVehicleId:GARAGE,fitOnly:true});
 assert.equal(result.get("gv"),GARAGE);assert.equal(result.get("fit"),"1");
 for(const key of ["cv","cy","cf","ce","vehicle","vr","vc"])assert.equal(result.has(key),false,key);
 assert.equal(result.get("q"),"alternator");
});

test("manual catalogue selection atomically clears Garage and legacy contexts",()=>{
 const result=setVehicleContext(new URLSearchParams("gv="+GARAGE+"&vehicle=legacy&cv=old&cy=2018"),{kind:"catalogue",variantId:VARIANT,year:2020,fuel:"petrol",engine:1984,fitOnly:false});
 assert.equal(result.get("gv"),null);assert.equal(result.get("vehicle"),null);
 assert.equal(result.get("cv"),VARIANT);assert.equal(result.get("cy"),"2020");assert.equal(result.get("cf"),"petrol");assert.equal(result.get("ce"),"1984");assert.equal(result.get("fit"),"0");
});

test("URL Garage selection wins conflict and stale storage; invalid or other-viewer Garage fails closed",()=>{
 const params=new URLSearchParams("gv="+GARAGE+"&cv="+VARIANT+"&cy=2020&cf=diesel&ce=2000");
 const resolved=resolveVehicleContext(params,{viewerId:"viewer-a",garageValid:true,stored:{viewerId:"viewer-a",selection:{kind:"catalogue",variantId:VARIANT,year:2020}}});
 assert.equal(resolved.selection.kind,"garage");assert.equal(resolved.params.get("gv"),GARAGE);assert.equal(resolved.params.has("cv"),false);
 const invalid=resolveVehicleContext(params,{viewerId:"viewer-a",garageValid:false});
 assert.equal(invalid.selection.kind,"invalid-garage");assert.equal(invalid.params.has("gv"),false);assert.equal(invalid.params.has("cv"),false);
 const malformed=resolveVehicleContext(new URLSearchParams("gv=not-a-uuid&cv="+VARIANT+"&cy=2020"),{viewerId:"viewer-a"});
 assert.equal(malformed.selection.kind,"invalid-garage");assert.equal(malformed.params.has("cv"),false);
});

test("explicit manual URL beats stored Garage and normalizes away stale gv",()=>{
 const resolved=resolveVehicleContext(new URLSearchParams("cv="+VARIANT+"&cy=2020"),{viewerId:"viewer-a",garageValid:true,stored:{viewerId:"viewer-a",selection:{kind:"garage",garageVehicleId:GARAGE,fitOnly:true}}});
 assert.equal(resolved.selection.kind,"catalogue");assert.equal(resolved.params.has("gv"),false);assert.equal(resolved.clearStored,true);
});

test("storage restores only same signed-in viewer, and add mode suppresses it",()=>{
 const stored={viewerId:"viewer-a",selection:{kind:"garage",garageVehicleId:GARAGE,fitOnly:false}};
 assert.equal(resolveVehicleContext(new URLSearchParams("q=brake"),{viewerId:"viewer-a",stored,garageValid:true}).selection.kind,"garage");
 assert.equal(resolveVehicleContext(new URLSearchParams("q=brake"),{viewerId:"viewer-b",stored}).selection.kind,"none");
 assert.equal(resolveVehicleContext(new URLSearchParams("addVehicle=1"),{viewerId:"viewer-a",stored,garageValid:true,addVehicleMode:true}).selection.kind,"none");
 assert.equal(resolveVehicleContext(new URLSearchParams("q=brake"),{viewerId:null,stored}).selection.kind,"none");
});

test("stored context envelope is viewer-bound and rejects malformed or legacy unscoped values",()=>{
 const envelope=JSON.stringify({viewerId:"viewer-a",selection:{kind:"garage",garageVehicleId:GARAGE,fitOnly:true}});
 assert.equal(exports.readStoredVehicleContext(envelope,"viewer-a").selection.garageVehicleId,GARAGE);
 assert.equal(exports.readStoredVehicleContext(envelope,"viewer-b"),null);
 assert.equal(exports.readStoredVehicleContext(envelope,null),null);
 assert.equal(exports.readStoredVehicleContext(JSON.stringify({cv:VARIANT,cy:"2020"}),"viewer-a"),null);
 assert.equal(exports.readStoredVehicleContext("{broken","viewer-a"),null);
});

test("no-context stale partial catalogue is cleared and context key inventory includes all competing fields",()=>{
 const result=resolveVehicleContext(new URLSearchParams("cv="+VARIANT+"&cy=2020&ce=bad&cf=petrol&gv="),{viewerId:"viewer-a"});
 assert.equal(result.selection.kind,"invalid-garage");
 assert.equal(result.params.has("cv"),false);
 assert.deepEqual(Array.from(VEHICLE_CONTEXT_PARAMS),["gv","cv","cy","cf","ce","vehicle","vr","vc","fit"]);
});
