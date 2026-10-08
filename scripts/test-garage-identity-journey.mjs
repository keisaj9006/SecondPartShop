import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const jsxRuntime={Fragment:Symbol("Fragment"),jsx:(type,props,key)=>({type,props:props??{},key:key??null}),jsxs:(type,props,key)=>({type,props:props??{},key:key??null})};
const GARAGE="22222222-2222-4222-8222-222222222222";
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const nodes=tree=>{const found=[];const visit=value=>{if(value===null||value===undefined||typeof value==="boolean")return;if(Array.isArray(value)){value.forEach(visit);return;}if(typeof value!=="object")return;if(typeof value.type==="function"){visit(value.type(value.props??{}));return;}found.push(value);visit(value.props?.children);};visit(tree);return found;};
const textContent=value=>{if(value===null||value===undefined||typeof value==="boolean")return "";if(Array.isArray(value))return value.map(textContent).join("");if(typeof value==="object")return textContent(value.props?.children);return String(value);};

function hookRunner(){
 const state=[],refs=[],effectDeps=[],cleanups=[];let hookIndex=0,pending=[];
 const react={
  useId(){return `id-${hookIndex++}`;},
  useState(initial){const i=hookIndex++;if(!(i in state))state[i]=typeof initial==="function"?initial():initial;return [state[i],next=>{state[i]=typeof next==="function"?next(state[i]):next;}];},
  useRef(initial){const i=hookIndex++;if(!(i in refs))refs[i]={current:initial};return refs[i];},
  useEffect(effect,deps){const i=hookIndex++;const prev=effectDeps[i];const changed=!prev||!deps||deps.length!==prev.length||deps.some((v,j)=>!Object.is(v,prev[j]));effectDeps[i]=deps;if(changed)pending.push({i,effect});},
  useTransition(){hookIndex++;return [false,callback=>callback()];},
  useActionState(action,initial){const i=hookIndex++;if(!(i in state))state[i]=initial;const dispatch=async formData=>{state[i]=await action(state[i],formData);return state[i];};return [state[i],dispatch,false];}
 };
 return {react,render(component,props){hookIndex=0;pending=[];return component(props);},async flushEffects(){const effects=pending;pending=[];for(const {i,effect} of effects){cleanups[i]?.();const cleanup=effect();cleanups[i]=typeof cleanup==="function"?cleanup:undefined;}await settle();}};
}

function selectorModule(runner,{lookupPayload,saveResult,storageCalls}){
 const source=fs.readFileSync(path.join(root,"src/components/vehicle-selector.tsx"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};const pushes=[];
 vm.runInNewContext(compiled,{exports,require(name){if(name==="react/jsx-runtime")return jsxRuntime;if(name==="react")return runner.react;if(name==="next/link")return "a";if(name==="next/navigation")return {useRouter:()=>({push:value=>pushes.push(value)})};if(name==="lucide-react")return new Proxy({},{get:()=>()=>null});if(name==="@/components/vehicle-visual")return {VehicleVisual:()=>null};if(name==="@/lib/vehicle-context")return {clearStoredVehicleContext(){},setVehicleContext:(params,selection)=>{for(const k of ["gv","cv","cy","cf","ce","vehicle","vr","vc","fit"])params.delete(k);if(selection.kind==="garage"){params.set("gv",selection.garageVehicleId);params.set("fit",selection.fitOnly?"1":"0");}return params;}};if(name==="@/app/garage/actions")return {saveGarageVehicle:async form=>{storageCalls.saves.push(Object.fromEntries(form));return saveResult;}};throw new Error(`Unexpected dependency ${name}`);},URL,URLSearchParams,AbortController,console,window:{setTimeout,clearTimeout},document:{},fetch:async url=>url==="/api/vehicle-lookup"?{ok:true,status:200,json:async()=>lookupPayload}:{ok:true,status:200,json:async()=>({items:[]})}});
 return {VehicleSelector:exports.VehicleSelector,pushes};
}

function homeModule(calls,garageVehicle){
 const source=fs.readFileSync(path.join(root,"src/app/page.tsx"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 vm.runInNewContext(compiled,{exports,require(name){if(name==="react/jsx-runtime")return jsxRuntime;if(name==="next/server")return {after(){}};if(name==="@/components/header")return {Header:()=>null};if(name==="@/components/marketplace-home")return {MarketplaceHome:props=>({type:"MarketplaceHome",props})};if(name==="@/lib/data/marketplace")return {getCategories:async()=>[],getMarketplacePage:async(filters)=>{calls.marketplace.push(filters);return {data:[{id:"part-1"}],error:null,configured:true,pagination:{offset:0,limit:24,returned:1,total:1,hasMore:false,mode:"offset",nextCursor:null}};},getSavedPartIdsForParts:async()=>[],getVehicleById:async()=>null};if(name==="@/lib/data/garage")return {getGarageVehicleById:async()=>garageVehicle,getGarageVehicleMatch:async()=>null,getGarageVehiclesPage:async()=>({items:[],hasMore:false,offset:0,limit:4})};if(name==="@/lib/data/buyer-account")return {getRecentlyViewedListings:async()=>[]};if(name==="@/lib/data/vehicle-catalogue")return {getCatalogueSelection:async()=>null};if(name==="@/lib/auth")return {getCurrentUser:async()=>({id:"viewer-a"})};if(name==="@/lib/vehicle-registration")return {normalizeRegistration:value=>value};if(name==="@/lib/postcode")return {normalizePostcode:value=>value};if(name==="@/lib/identifiers")return {isUuid:()=>true};if(name==="@/lib/analytics/search")return {recordMarketplaceSearch(){}};if(name==="@/lib/metadata")return {buildHomeMetadata:()=>({})};if(name==="@/lib/vehicle-context")return {resolveVehicleContext:(params,options)=>{const garageId=params.get("gv");if(garageId&&options.garageValid===false)return {params,selection:{kind:"invalid-garage"}};return {params,selection:garageId?{kind:"garage",garageVehicleId:garageId,fitOnly:params.get("fit")!=="0"}:{kind:"none"}};}};if(name==="@/lib/data/compatibility")return {compatibilityInfo:level=>({level,label:"Fit not verified — may not fit"})};throw new Error(`Unexpected dependency ${name}`);},URLSearchParams,URL});
 return exports.default;
}

const unresolvedGarage={id:GARAGE,catalogueVariantId:null,registration:"AB12CDE",year:2019,fuelType:"PETROL",engineSizeSimple:1998,colour:"GREY",nickname:null,make:"FORD",model:"TRANSIT",modelFamily:"TRANSIT",variant:null,createdAt:"2026-01-01T00:00:00Z"};

test("successful DVSA identity lookup submits a provider-backed Garage identity without a derivative",async()=>{
 const runner=hookRunner(),storageCalls={saves:[]};
 const {VehicleSelector}=selectorModule(runner,{lookupPayload:{registration:"AB12CDE",vehicle:{make:"FORD",model:"TRANSIT",year:2019,engineSizeSimple:1998,fuelType:"PETROL",colour:"GREY"}},saveResult:{ok:true,id:GARAGE,outcome:"created",catalogueVariantId:null,message:"Vehicle added to your Garage."},storageCalls});
 const props={vehicles:[],selectedCatalogue:null,baseParams:{q:"alternator"},compatibleOnly:true,signedIn:true};
 let tree=runner.render(VehicleSelector,props);
 const registration=nodes(tree).find(node=>node.type==="input"&&node.props.id==="registration");
 registration.props.onChange({target:{value:"AB12 CDE"}});
 tree=runner.render(VehicleSelector,props);
 nodes(tree).find(node=>node.type==="button"&&textContent(node)==="Find my vehicle").props.onClick();
 await settle();tree=runner.render(VehicleSelector,props);await runner.flushEffects();tree=runner.render(VehicleSelector,props);
 assert.ok(nodes(tree).some(node=>node.type==="button"&&/Add to Garage/.test(textContent(node))),"identity-only result needs a deliberate Add to Garage action");
 assert.match(textContent(tree),/1998cc/);
 assert.match(textContent(tree),/exact.*compatib/i);
 assert.equal(storageCalls.saves.length,0);
 const form=nodes(tree).find(node=>node.type==="form");assert.ok(form,"identity save is an explicit form action");
 const submitted=new FormData();for(const input of nodes(tree).filter(node=>node.type==="input"&&node.props.type==="hidden")){submitted.set(input.props.name,input.props.value);}
 await form.props.action(submitted);
 tree=runner.render(VehicleSelector,props);nodes(tree);await runner.flushEffects();
 assert.equal(storageCalls.saves.length,1);
 assert.equal(storageCalls.saves[0].operation,"identity_save");
 assert.equal(storageCalls.saves[0].registration,"AB12CDE");
 assert.equal("make" in storageCalls.saves[0],false,"client-supplied identity is not sent as provider evidence");
});

test("identity-only Garage fit ON is unresolved without calling marketplace compatibility; fit OFF browses with unverified labels",async()=>{
 const calls={marketplace:[]};const Home=homeModule(calls,unresolvedGarage);
 const unresolved=await Home({searchParams:Promise.resolve({gv:GARAGE,fit:"1",q:"alternator"})});
 const unresolvedProps=unresolved.props.children[1].props;
 assert.equal(calls.marketplace.length,0,"fit ON must not call catalogue or broad marketplace compatibility");
 assert.equal(unresolvedProps.identityOnlyFitmentUnresolved,true);
 assert.equal(unresolvedProps.listings.length,0);
 const browse=await Home({searchParams:Promise.resolve({gv:GARAGE,fit:"0",q:"alternator"})});
 const browseProps=browse.props.children[1].props;
 assert.equal(calls.marketplace.length,1);
 assert.equal(browseProps.identityOnlyFitmentUnresolved,false);
 assert.equal(browseProps.listings[0].compatibility.level,"unverified");
});
