import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const cv='00000000-0000-4000-8000-000000006001';
function load(file,deps){const exports={};const jsx=(type,props)=>({type,props});vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URL,URLSearchParams,require(name){if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};if(name in deps)return deps[name];throw Error(name);}});return exports;}
function caller(kind,selection='valid',garageVehicle=null){
 const calls=[];const deps={
 '@/unused':{},'next/server':{after:()=>{}},
 '@/lib/data/vehicle-catalogue':{getCatalogueSelection:async(_variant,_year,fuel,engine)=>{if(selection==='throw')throw Error('provider unavailable');return selection==='valid'?{variantId:cv,year:2020,fuelType:fuel,engineSizeSimple:engine}:null;}},
 '@/lib/data/marketplace':{getMarketplacePage:async(filters,options)=>{calls.push({filters,options});return {data:kind==='home'?[{id:'part-1'}]:[],error:null,configured:true,pagination:{offset:0,limit:24,returned:kind==='home'?1:0,total:kind==='home'?1:null,hasMore:false,mode:'offset',nextCursor:null}};},getCategories:async()=>[],getVehicleById:async()=>null,getSavedPartIdsForParts:async()=>[]},
 '@/lib/identifiers':{isUuid:value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)},
 '@/lib/postcode':{normalizePostcode:value=>value},'@/lib/public-listing':{toPublicListing:item=>item},'@/lib/analytics/search':{recordMarketplaceSearch:()=>{}},
 '@/lib/mobile-api':{mobileJson:(_request,body,status)=>({body,status}),mobilePublicJson:(_request,body,status)=>({body,status})},'@/lib/mobile-image':{mobileThumbnailUrl:()=>null},
 '@/components/header':{Header:'Header'},'@/components/marketplace-home':{MarketplaceHome:'MarketplaceHome'},'@/lib/data/garage':{getGarageVehicleById:async()=>garageVehicle,getGarageVehicleMatch:async()=>null,getGarageVehiclesPage:async()=>({items:garageVehicle?[garageVehicle]:[],hasMore:false,offset:0,limit:4})},'@/lib/data/buyer-account':{getRecentlyViewedListings:async()=>[]},'@/lib/auth':{getCurrentUser:async()=>garageVehicle?{id:'viewer-a'}:null},'@/lib/vehicle-registration':{normalizeRegistration:value=>value},
 '@/lib/data/compatibility':{compatibilityInfo:level=>({level,label:level==='unverified'?'Fit not verified — may not fit':'Confirmed for your vehicle'})},
 '@/lib/metadata':{buildHomeMetadata:()=>({})},'@/lib/vehicle-context':load('src/lib/vehicle-context.ts',{})
 };
 const entry=load(kind==='mobile'?'src/app/api/mobile/v1/marketplace/route.ts':'src/app/page.tsx',deps);
 return {calls,async run(params){if(kind==='mobile')return entry.GET({url:'https://fixture.invalid/?'+new URLSearchParams(params)});const result=await entry.default({searchParams:Promise.resolve(params)});return result.props.children.find(node=>node.type==='MarketplaceHome').props;}};
}
for(const kind of ['mobile','home']){
 for(const params of [{cv},{cy:'2020'},{cv:'',cy:'2020'},{cv,cy:''},{cv:'broken',cy:'2020'},{cv,cy:'0'},{cv,cy:'20.2'},{cv,cy:'bad'},{cv,cy:'2020',ce:'broken'},{cv,cy:'2020',ce:'20.2'},{cv,cy:'2020',ce:''}])test(`${kind} search rejects explicit incomplete/malformed catalogue ${JSON.stringify(params)}`,async()=>{
  const h=caller(kind);const result=await h.run({q:'DSG',...params,fit:'0',vehicle:cv});assert.equal(h.calls.length,0);if(kind==='mobile')assert.equal(result.status,503);else assert.match(result.error,/compatibility.*unavailable/i);
 });
 for(const selection of ['null','throw'])test(`${kind} search rejects failed selection lookup`,async()=>{const h=caller(kind,selection);const result=await h.run({q:'DSG',cv,cy:'2020',fit:'1'});assert.equal(h.calls.length,0);if(kind==='home')assert.match(result.error,/compatibility.*unavailable/i);else assert.equal(result.status,503);});
 test(`${kind} valid catalogue and context-free search reach page boundary`,async()=>{
  for(const params of [{q:'DSG',cv,cy:'2020'},{q:'DSG'}]){const h=caller(kind);await h.run(params);assert.equal(h.calls.length,1);if(params.cv===cv)assert.equal(h.calls[0].filters.catalogueVariant,cv);if(kind==='home')assert.equal(h.calls[0].options.lean,true);}
 });
 test(`${kind} valid optional fuel and engine reach the page boundary`,async()=>{const h=caller(kind);await h.run({q:'DSG',cv,cy:'2020',cf:'PETROL',ce:'2000',fit:'0'});assert.equal(h.calls[0].filters.catalogueFuel,'PETROL');assert.equal(h.calls[0].filters.catalogueEngineSize,2000);assert.equal(h.calls[0].filters.compatibleOnly,false);});
}
test('Home addVehicle=1 intentionally starts a new selection despite stale invalid catalogue',async()=>{const h=caller('home');await h.run({q:'DSG',cv:'broken',cy:'0',addVehicle:'1'});assert.equal(h.calls.length,1);assert.equal(h.calls[0].filters.catalogueVariant,undefined);});

test('Home keeps identity-only Garage fit ON unresolved and uses unverified broad browse with fit OFF',async()=>{
 const garageId='22222222-2222-4222-8222-222222222222';
 const garageVehicle={id:garageId,catalogueVariantId:null,registration:'AB12CDE',year:2019,fuelType:'PETROL',engineSizeSimple:1998,colour:'GREY',nickname:null,make:'FORD',model:'TRANSIT',modelFamily:'TRANSIT',variant:null,createdAt:'2026-01-01T00:00:00Z'};
 const unresolved=caller('home','valid',garageVehicle);
 const unresolvedResult=await unresolved.run({gv:garageId,fit:'1',q:'DSG'});
 assert.equal(unresolved.calls.length,0);
 assert.equal(unresolvedResult.identityOnlyFitmentUnresolved,true);
 assert.equal(unresolvedResult.listings.length,0);

 const broad=caller('home','valid',garageVehicle);
 const broadResult=await broad.run({gv:garageId,fit:'0',q:'DSG'});
 assert.equal(broad.calls.length,1);
 assert.equal(broadResult.identityOnlyFitmentUnresolved,false);
 assert.equal(broadResult.listings[0].compatibility.level,'unverified');
});

for(const selection of ['null','throw'])test('mobile no-query fit ON rejects '+selection+' catalogue lookup',async()=>{
 const h=caller('mobile',selection);const result=await h.run({cv,cy:'2020',fit:'1'});assert.equal(h.calls.length,0);assert.equal(result.status,503);assert.equal(result.body.ok,false);
});
for(const params of [{cv},{cy:'2020'},{cv:'broken',cy:'2020'},{cv,cy:'2020',ce:'broken'},{cf:'PETROL'},{ce:'2000'}])test('mobile no-query fit ON rejects invalid explicit context '+JSON.stringify(params),async()=>{
 const h=caller('mobile');const result=await h.run(params);assert.equal(h.calls.length,0);assert.equal(result.status,503);
});
test('mobile no-query context-free browse, valid fit selection and intentional fit OFF still reach marketplace',async()=>{
 for(const params of [{},{cv,cy:'2020'},{cv:'broken',cy:'2020',fit:'0'}]){const h=caller('mobile');const result=await h.run(params);assert.equal(h.calls.length,1);assert.equal(result.status,200);if(params.cv===cv)assert.equal(h.calls[0].filters.compatibleOnly,true);else assert.equal(h.calls[0].filters.compatibleOnly,false);}
});
