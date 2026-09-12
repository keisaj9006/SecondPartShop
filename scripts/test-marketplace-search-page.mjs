import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('src/lib/data/marketplace.ts','utf8');
function load(dependencies){
 const exports={};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,process:{env:{}},require(name){if(name in dependencies)return dependencies[name];throw Error(name);}});
 return exports;
}
function harness({rows=Array.from({length:25},(_,i)=>({part_id:`part-${i}`,confidence:'buyer_verified',distance_miles:i+.123,distance_approximate:true})),error=null,missing=[]}={}){
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='category_descendant_ids')return {data:[{id:'child'}],error:null};return {data:rows,error};},from(table){
 const query={select(value){calls.push({table,select:value});return query;},eq(){return query;},in(key,ids){calls.push({table,key,ids:[...ids]});query.ids=ids;return query;},then(resolve){
 return Promise.resolve({error:null,data:table==='part_images'?[]:[...query.ids].reverse().filter(id=>!missing.includes(id)).map(id=>({id,seller_id:'seller',categories:{id:'category',search_terms:[]},sellers:{id:'seller'}}))}).then(resolve);
 }};return query;
 }};
 return {calls,...load({'server-only':{},'@/lib/supabase/server':{createSupabaseServerClient:async()=>client},'@/lib/supabase/public-server':{},'next/cache':{unstable_cache:fn=>fn},'@/lib/supabase/env':{isSupabaseConfigured:()=>true},'@/lib/category-tree':{},'@/lib/data/compatibility':{compatibilityInfo:level=>({level}),getCompatibilityMap(){throw Error('broad compatibility call');}},'@/lib/postcode':{lookupPostcodeLocation:async postcode=>postcode==='INVALID'?null:{latitude:51,longitude:0}}})};
}
for(const context of [{},{catalogueVariant:'variant',catalogueYear:2020},{vehicle:'legacy'},{sort:'distance',postcode:'SW1A1AA'},{catalogueVariant:'variant',catalogueYear:2020,sort:'distance',postcode:'SW1A1AA'}]){
 test(`search uses one bounded page RPC and preserves hydration order ${JSON.stringify(context)}`,async()=>{
 const h=harness();const result=await h.getMarketplacePage({query:'alternator',...context},{limit:24,offset:504,lean:true});
 assert.equal(result.error,null);assert.equal(h.calls.filter(call=>call.name).length,1);
 assert.equal(h.calls[0].name,'marketplace_search_page_v1');assert.equal(h.calls[0].args.p_limit,24);assert.equal(h.calls[0].args.p_offset,504);
 assert.equal(result.pagination.total,null);assert.equal(result.pagination.hasMore,true);assert.equal(result.pagination.mode,'offset');
 assert.deepEqual(Array.from(result.data,item=>item.id),Array.from({length:24},(_,i)=>`part-${i}`));
 for(const call of h.calls.filter(call=>call.ids)){assert.equal(call.ids.length,24);assert.ok(!call.ids.includes('part-24'));}
 assert.ok(!h.calls.find(call=>call.select?.split('categories!inner')[0].includes('description')));
 });
}
test('search page failure is closed without old search or browse fallback',async()=>{
 const h=harness({error:{message:'unavailable'}});const result=await h.getMarketplacePage({query:'alternator'});
 assert.match(result.error,/search.*unavailable/i);assert.equal(result.data.length,0);assert.equal(h.calls.length,1);
});
test('empty/final pages, cap and rows lost before hydration retain unknown total',async()=>{
 for(const count of [0,1,60,61]){
 const h=harness({rows:Array.from({length:count},(_,i)=>({part_id:`part-${i}`,confidence:null,distance_miles:null,distance_approximate:false})),missing:['part-0']});
 const result=await h.getMarketplacePage({query:'test'},{limit:500});
 assert.equal(h.calls[0].args.p_limit,60);assert.equal(result.pagination.total,null);assert.equal(result.pagination.hasMore,count>60);
 assert.equal(result.data.length,Math.max(0,Math.min(count,60)-1));
 }
});
test('search forwards all eligibility filters, uses only selected IDs, and attaches confidence/distance',async()=>{
 const h=harness();const result=await h.getMarketplacePage({query:' alternator ',category:'parent',condition:'used',minPrice:1.235,maxPrice:500,collectionOnly:true,catalogueVariant:'variant',catalogueYear:2020,catalogueFuel:'PETROL',catalogueEngineSize:2000,vehicle:'legacy',compatibleOnly:false,ids:['part-1'],sort:'distance',postcode:'SW1A1AA'});
 const call=h.calls.find(c=>c.name==='marketplace_search_page_v1');
 assert.deepEqual(JSON.parse(JSON.stringify(call.args)),{p_query:'alternator',p_sort:'distance',p_category_ids:['child'],p_condition:'used',p_min_price_pence:124,p_max_price_pence:50000,p_collection_only:true,p_variant_id:'variant',p_year:2020,p_fuel:'PETROL',p_engine:2000,p_vehicle_id:'legacy',p_compatible_only:false,p_buyer_lat:51,p_buyer_lon:0,p_part_ids:['part-1'],p_limit:24,p_offset:0});
 assert.equal(result.data[0].compatibility.level,'buyer_verified');assert.equal(result.data[0].distanceMiles,.1);assert.equal(result.data[0].distanceApproximate,true);
});
test('incomplete direct catalogue or invalid postcode fail closed before search',async()=>{
 for(const filters of [{query:'test',catalogueVariant:'variant'},{query:'test',catalogueYear:2020},{query:'test',sort:'distance',postcode:'INVALID'}]){
 const h=harness();const result=await h.getMarketplacePage(filters);assert.ok(result.error);assert.equal(h.calls.length,0);
 }
});
