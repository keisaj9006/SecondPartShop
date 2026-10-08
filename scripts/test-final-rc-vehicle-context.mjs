import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const VARIANT='33333333-3333-4333-8333-333333333333',GARAGE='11111111-1111-4111-8111-111111111111';
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function load(file,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URLSearchParams,URL,require:n=>n==='react/jsx-runtime'?jsx:n in deps?deps[n]:(()=>{throw Error(n)})(),...globals});return exports;}
const context=load('src/lib/vehicle-context.ts');
function homeHarness({selection=null,garage=null,throwCatalogue=false}={}){
 const calls=[],empty=async()=>[];
 const {default:Home}=load('src/app/page.tsx',{
  'next/server':{after(){}},'@/components/header':{Header:'Header'},'@/components/marketplace-home':{MarketplaceHome:'MarketplaceHome'},
  '@/lib/data/marketplace':{getCategories:empty,getSavedPartIdsForParts:empty,getVehicleById:async()=>null,getMarketplacePage:async filters=>{calls.push(filters);return {data:[{id:'broad-result'}],error:null,configured:true,pagination:{offset:0,limit:24,returned:1,hasMore:false}};}},
  '@/lib/data/garage':{getGarageVehicleById:async()=>garage,getGarageVehicleMatch:async()=>null,getGarageVehiclesPage:async()=>({items:[]})},
  '@/lib/data/buyer-account':{getRecentlyViewedListings:empty},'@/lib/data/vehicle-catalogue':{getCatalogueSelection:async()=>{if(throwCatalogue)throw Error('catalogue unavailable');return selection;}},
  '@/lib/auth':{getCurrentUser:async()=>({id:'viewer'})},'@/lib/vehicle-registration':{normalizeRegistration:x=>x},'@/lib/postcode':{normalizePostcode:x=>x},'@/lib/identifiers':{isUuid:x=>/^[0-9a-f-]{36}$/i.test(x)},
  '@/lib/analytics/search':{recordMarketplaceSearch(){}},'@/lib/metadata':{buildHomeMetadata:()=>({})},'@/lib/vehicle-context':context,'@/lib/data/compatibility':{compatibilityInfo:level=>({level})}
 });
 return {calls,async render(params){const result=await Home({searchParams:Promise.resolve(params)});return result.props.children[1].props;}};
}
for(const query of [undefined,'alternator'])for(const unavailable of ['malformed','missing','failure','garage-derivative'])test(`fit ON remains closed for ${unavailable} vehicle with query ${query??'absent'}`,async()=>{
 const h=homeHarness({throwCatalogue:unavailable==='failure',garage:unavailable==='garage-derivative'?{id:GARAGE,catalogueVariantId:VARIANT,year:2020}:null});
 const params=unavailable==='garage-derivative'?{gv:GARAGE,fit:'1'}:{cv:unavailable==='malformed'?'bad-id':VARIANT,cy:'2020',fit:'1'};if(query)params.q=query;
 const props=await h.render(params);assert.equal(h.calls.length,0,'unresolved selected vehicle must not call broad marketplace browse');assert.equal(props.listings.length,0);assert.match(props.error,/compatibility.*unavailable/i);
});
test('invalid legacy vehicle fit ON cannot become unrestricted browse',async()=>{const h=homeHarness(),props=await h.render({vehicle:'bad-id',fit:'1'});assert.equal(h.calls.length,0);assert.match(props.error,/compatibility.*unavailable/i);});
test('intentional fit OFF and add-vehicle mode retain unrestricted browse',async()=>{for(const params of [{cv:VARIANT,cy:'2020',fit:'0'},{cv:'bad-id',cy:'2020',fit:'0'},{cv:VARIANT,cy:'2020',fit:'1',addVehicle:'1'}]){const h=homeHarness(),props=await h.render(params);assert.equal(h.calls.length,1);assert.equal(props.error,null);assert.equal(props.filters.compatibleOnly,false);}});
test('valid catalogue selection continues to pass exact context to marketplace',async()=>{const h=homeHarness({selection:{variantId:VARIANT,year:2020,fuelType:'PETROL',engineSizeSimple:2000}}),props=await h.render({cv:VARIANT,cy:'2020',fit:'1'});assert.equal(h.calls.length,1);assert.equal(props.error,null);assert.equal(h.calls[0].catalogueVariant,VARIANT);assert.equal(h.calls[0].compatibleOnly,true);});
function persistenceHarness(query,{garageContextValid=true,stored=null}={}){
 const replacements=[],storageWrites=[],storageRemovals=[],effects=[];
 const storage={getItem:()=>stored,setItem:(key,value)=>storageWrites.push([key,value]),removeItem:key=>storageRemovals.push(key)};
 const vehicleContext=load('src/lib/vehicle-context.ts',{},{window:{localStorage:storage}});
 const deps={'react':{useRef:value=>({current:value}),useEffect:effect=>effects.push(effect)},'next/navigation':{usePathname:()=>'/',useRouter:()=>({replace:url=>replacements.push(url)}),useSearchParams:()=>new URLSearchParams(query)},'@/lib/vehicle-context':vehicleContext};
 const subject=load('src/components/vehicle-context-persistence.tsx',deps,{window:{localStorage:storage}});
 subject.VehicleContextPersistence({viewerId:'viewer',garageContextValid});effects.forEach(effect=>effect());return {replacements,storageWrites,storageRemovals};
}
for(const query of [`cv=bad-id&cy=2020&fit=1&q=alternator`,`gv=${GARAGE}&fit=1&q=alternator`,`vehicle=&fit=1&q=alternator`])test(`persistence retains explicit invalid context: ${query}`,()=>{const h=persistenceHarness(query,{garageContextValid:false});assert.equal(h.replacements.length,0,'normalization must not discard selected-vehicle error');assert.equal(h.storageWrites.length,0);});
test('persistence still normalizes valid precedence, add mode and storage restore',()=>{
 const valid=persistenceHarness(`gv=${GARAGE}&cv=${VARIANT}&cy=2020&fit=1`);assert.equal(valid.replacements.length,1);assert.ok(!valid.replacements[0].includes('cv='));
 const add=persistenceHarness(`gv=${GARAGE}&addVehicle=1`);assert.equal(add.replacements.length,1);assert.ok(!add.replacements[0].includes('gv='));
 const restore=persistenceHarness('q=alternator',{stored:JSON.stringify({viewerId:'viewer',selection:{kind:'garage',garageVehicleId:GARAGE,fitOnly:true}})});assert.equal(restore.replacements.length,1);assert.ok(restore.replacements[0].includes(`gv=${GARAGE}`));
});
