import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const VARIANT='33333333-3333-4333-8333-333333333333';
function load(file,deps={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams,require(name){if(name in deps)return deps[name];throw Error(name);}});return exports;
}
const context=load('src/lib/vehicle-context.ts');
function harness(){
 let saved;const revalidated=[];
 const subject=load('src/app/saved-searches/actions.ts',{'next/cache':{revalidatePath:path=>revalidated.push(path)},'@/lib/auth':{requireUser:async()=>({id:'viewer'})},'@/lib/supabase/server':{createSupabaseServerClient:async()=>({from:table=>{assert.equal(table,'saved_searches');return {insert:async row=>{saved=row;return {error:null};}};}})}});
 return {async save(params){const form=new FormData();form.set('name','Alternators');form.set('searchParams',JSON.stringify(params));const result=await subject.createSavedSearch({status:'idle'},form);return {result,saved,revalidated};}};
}
for(const fit of ['0','1'])test(`web saved-search round trip retains explicit fit=${fit}`,async()=>{
 const {result,saved}=await harness().save({q:'alternator',cv:VARIANT,cy:'2020',fit});
 assert.equal(result.status,'success');assert.equal(saved.profile_id,'viewer');
 assert.equal(saved.search_params.fit,fit,'saved filter payload must retain buyer fit intent');
 const reopened=context.resolveVehicleContext(new URLSearchParams(saved.search_params),{viewerId:'viewer'});
 assert.equal(reopened.selection.kind,'catalogue');assert.equal(reopened.selection.fitOnly,fit==='1');
});
test('saving without a fit override retains default fit ON and rejects unrelated parameters',async()=>{
 const {saved}=await harness().save({q:'alternator',cv:VARIANT,cy:'2020',admin:'true',fit:'x'.repeat(201),unexpected:123});
 assert.equal(saved.search_params.fit,undefined);assert.equal(saved.search_params.admin,undefined);assert.equal(saved.search_params.unexpected,undefined);
 assert.equal(context.resolveVehicleContext(new URLSearchParams(saved.search_params),{viewerId:'viewer'}).selection.fitOnly,true);
});

async function readSavedSearch(saved){
 const result={data:[{id:'search-fixture',name:saved.name,search_params:saved.search_params,created_at:'2026-10-08T00:00:00Z'}],error:null};
 const query={select(){return this;},eq(){return this;},order(){return this;},range:async()=>result};
 const subject=load('src/lib/data/buyer-account.ts',{'server-only':{},'@/lib/supabase/server':{createSupabaseServerClient:async()=>({from:()=>query})},'@/lib/data/marketplace':{getListingCardsByIds:async()=>[]}});
 return (await subject.getSavedSearchesPage('viewer')).items[0];
}
for(const fit of ['0','1'])test(`saved-search database read and Run search URL retain explicit fit=${fit}`,async()=>{
 const {saved}=await harness().save({q:'alternator',cv:VARIANT,cy:'2020',fit,admin:'true'});
 const item=await readSavedSearch(saved);
 const runSearchUrl=new URL('/?'+new URLSearchParams(item.params)+'#marketplace','https://preview.example.test');
 assert.equal(runSearchUrl.searchParams.get('fit'),fit,'database read must preserve saved fit intent before navigation');
 assert.equal(runSearchUrl.searchParams.has('admin'),false);
 const reopened=context.resolveVehicleContext(runSearchUrl.searchParams,{viewerId:'viewer'});
 assert.equal(reopened.selection.kind,'catalogue');assert.equal(reopened.selection.fitOnly,fit==='1');
});
