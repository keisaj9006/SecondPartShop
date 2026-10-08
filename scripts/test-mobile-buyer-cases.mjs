import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const actor='buyer-owned';
const retained={id:'case-owned',order_item_id:'item-owned',status:'open',case_type:'return',reason:'Fit issue',details:'An ongoing return case',order_items:{part_id:'part-sold',parts:null,sellers:{business_name:'Fixture seller',slug:'fixture-seller'},orders:{buyer_id:actor}}};
const code=ts.transpileModule(fs.readFileSync('src/app/api/mobile/v1/cases/route.ts','utf8'),{fileName:'route.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({rows=[retained],caseError=null,partError=null,partRows=[{id:'part-sold',title:'Retained sold part',slug:'retained-sold-part'}],signedIn=true,adminThrows=false}={}){
 const calls={filters:[],privileged:[],adminClients:0,projection:null};const query={select(){return this;},eq(key,value){calls.filters.push([key,value]);return this;},order(){return this;},range:async()=>({data:rows,error:caseError})};
 const admin={from(table){assert.equal(table,'parts');return{select(projection){calls.projection=projection;assert.equal(projection,'id,title,slug');return{async in(column,ids){assert.equal(column,'id');calls.privileged.push(...ids);if(adminThrows)throw Error('private provider detail');return{data:partRows,error:partError};}};}};}};
 const exports={};vm.runInNewContext(code,{exports,URL,require(name){if(name==='@/lib/mobile-api')return{mobileJson:(_r,payload,status=200)=>Response.json(payload,{status}),mobileOptions:()=>new Response(null,{status:204}),requireMobileUser:async()=>signedIn?{context:{user:{id:actor},supabase:{from:table=>{assert.equal(table,'transaction_cases');return query;}}}}:{context:null,response:Response.json({error:'unauthorized'},{status:401})}};if(name==='@/lib/supabase/admin')return{createSupabaseAdminClient(){calls.adminClients++;return admin;}};if(name==='@/lib/identifiers')return{};if(name==='@/lib/push/schedule')return{};throw Error(name);}});return{api:exports,calls};
}
test('buyer case list retains authorized sold-part identity and open return state',async()=>{
 const h=harness();const response=await h.api.GET(new Request('https://preview.example.test/api/mobile/v1/cases?partId=foreign-client-input'));const body=await response.json();assert.equal(response.status,200);assert.equal(body.items.length,1);assert.equal(body.items[0].id,retained.id);assert.equal(body.items[0].partTitle,'Retained sold part');assert.equal(body.items[0].status,'open');assert.equal(body.items[0].caseType,'return');assert.deepEqual(h.calls.privileged,['part-sold']);assert.ok(h.calls.filters.some(([key,value])=>key==='order_items.orders.buyer_id'&&value===actor));
});
test('visible case parts need no privileged fallback',async()=>{
 const h=harness({rows:[{...retained,order_items:{...retained.order_items,parts:{title:'Visible part',slug:'visible'}}}]});const response=await h.api.GET(new Request('https://preview.example.test'));assert.equal((await response.json()).items[0].partTitle,'Visible part');assert.equal(h.calls.adminClients,0);
});
for(const scenario of ['anonymous','no-authorized-case','case-read-error'])test('case list skips privileged lookup for '+scenario,async()=>{
 const h=harness({signedIn:scenario!=='anonymous',rows:[],caseError:scenario==='case-read-error'?{message:'private query details'}:null});const response=await h.api.GET(new Request('https://preview.example.test'));assert.equal(response.status,scenario==='anonymous'?401:scenario==='case-read-error'?503:200);assert.equal(h.calls.adminClients,0);
});
for(const scenario of ['provider-error','provider-throws','missing-retained-row'])test('case identity '+scenario+' fails explicitly rather than hiding the case',async()=>{
 const h=harness({partError:scenario==='provider-error'?{message:'private query details'}:null,adminThrows:scenario==='provider-throws',partRows:scenario==='missing-retained-row'?[]:undefined});const response=await h.api.GET(new Request('https://preview.example.test'));assert.equal(response.status,503);const body=await response.json();assert.equal(body.error,'case_items_unavailable');assert.equal(JSON.stringify(body).includes('private'),false);
});
test('privileged case identity lookup excludes pagination sentinel and deduplicates page IDs',async()=>{
 const next={...retained,id:'next-case',order_items:{...retained.order_items,part_id:'next-page-part'}};const h=harness({rows:[retained,next]});const response=await h.api.GET(new Request('https://preview.example.test?limit=1'));const body=await response.json();assert.equal(body.items.length,1);assert.equal(body.pagination.hasMore,true);assert.deepEqual(h.calls.privileged,['part-sold']);
});
for(const scenario of ['foreign-buyer','missing-order'])test('case identity lookup rejects '+scenario+' relationship before privileged read',async()=>{
 const h=harness({rows:[{...retained,order_items:{...retained.order_items,orders:scenario==='missing-order'?null:{buyer_id:'someone-else'}}}]});const r=await h.api.GET(new Request('https://preview.example.test'));assert.equal(r.status,503);assert.equal(h.calls.adminClients,0);
});
test('multiple authorized cases for the same part resolve identity once',async()=>{
 const h=harness({rows:[retained,{...retained,id:'second-case'}]});const r=await h.api.GET(new Request('https://preview.example.test'));assert.equal((await r.json()).items.length,2);assert.deepEqual(h.calls.privileged,['part-sold']);
});
test('missing retained seller metadata fails explicitly rather than silently hiding a case',async()=>{
 const h=harness({rows:[{...retained,order_items:{...retained.order_items,sellers:null}}]});const r=await h.api.GET(new Request('https://preview.example.test'));assert.equal(r.status,503);assert.equal((await r.json()).error,'case_items_unavailable');
});
