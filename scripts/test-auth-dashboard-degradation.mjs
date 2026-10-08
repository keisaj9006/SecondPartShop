import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
function load(path,modules){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require(name){if(name in modules)return modules[name];throw Error(name);}});
 return exports;
}
const counts={savedParts:2,savedSearches:3,garage:4,openRequests:5,recentlyViewed:6,unreadNotifications:7,orders:8};
async function dashboard(failure,view='buying'){
 const read=(name,value)=>async()=>{if(name===failure)throw Error('provider details');return value;};
 const subject=load('src/components/account-dashboard-content.tsx',{
  'react/jsx-runtime':await import('react/jsx-runtime'),
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  'lucide-react':new Proxy({},{get:()=>()=>null}),
  '@/components/product-card':{ProductCard:()=>React.createElement('div',null,'Product card')},
  '@/components/account-dashboard-retry':{AccountDashboardRetry:()=>React.createElement('button',null,'Retry')},
  '@/lib/data/buyer-account':{getBuyerAccountCounts:read('counts',counts),getRecentlyViewedListings:read('recent',[{id:'part'}])},
  '@/lib/data/reputation':{getPublicMemberProfileById:read('trust',{sellerReviewCount:1,buyerReviewCount:2})},
  '@/lib/data/listing-conversations':{getListingConversationCount:read('conversation',9)},
  '@/lib/data/marketplace':{getSavedPartIdsForParts:read('saved',[]),getSellerForOwner:read('seller',null)},
  '@/lib/data/fitting':{getGaragePartnerForOwner:read('partner',null)}
 });
 return renderToStaticMarkup(await subject.AccountDashboardContent({userId:'owner',role:'buyer',view}));
}
for(const failure of ['counts','recent','saved','trust','conversation','partner'])test(`${failure} failure keeps available dashboard sections and exposes Retry`,async()=>{
 const html=await dashboard(failure);
 assert.match(html,/Profile &amp; username/);
 assert.match(html,/temporarily unavailable/i);
 assert.match(html,/Retry/);
 assert.doesNotMatch(html,/provider details/);
 if(failure==='partner')assert.doesNotMatch(html,/>Join</);
 if(failure==='saved'||failure==='recent')assert.doesNotMatch(html,/Product card/);
 if(failure!=='counts')assert.match(html,/>8</);
});
test('seller failure does not pretend setup is needed',async()=>{
 const html=await dashboard('seller','selling');
 assert.match(html,/temporarily unavailable/i);assert.match(html,/Retry/);
 assert.doesNotMatch(html,/Finish setup|Finish your seller profile/);
});
function buyerDb(failed,throws=false){return {from(table){const query={select(){return this;},eq(){return this;},is(){return this;},then(resolve,reject){return (table===failed&&throws?Promise.reject(Error('network')):Promise.resolve({count:table===failed?99:4,error:table===failed?Error('read'):null})).then(resolve,reject);}};return query;}};}
for(const throws of [false,true])test(`individual count ${throws?'rejection':'query error'} remains unavailable while other counts survive`,async()=>{
 const subject=load('src/lib/data/buyer-account.ts',{'server-only':{},'@/lib/supabase/server':{createSupabaseServerClient:async()=>buyerDb('saved_parts',throws)},'@/lib/data/marketplace':{}});
 const result=await subject.getBuyerAccountCounts('owner');assert.equal(result.savedParts,null);assert.equal(result.orders,4);
});
test('retry refreshes server data with pending and accessible feedback',()=>{
 const source=fs.readFileSync(new URL('../src/components/account-dashboard-retry.tsx',import.meta.url),'utf8');
 assert.match(source,/router\.refresh\(\)/);assert.match(source,/useTransition/);assert.match(source,/disabled=\{isPending\}/);assert.match(source,/role="status"/);
});

function marketplace(error){
 const query={select(){return this;},eq(){return this;},in:async()=>({data:[],error})};
 return load('src/lib/data/marketplace.ts',{'server-only':{},'@/lib/supabase/server':{createSupabaseServerClient:async()=>({from:()=>query,rpc:async()=>({data:[],error})})},'@/lib/supabase/public-server':{},'next/cache':{unstable_cache:fn=>fn},'@/lib/supabase/env':{isSupabaseConfigured:()=>true},'@/lib/category-tree':{},'@/lib/data/compatibility':{},'@/lib/postcode':{}});
}
for(const method of ['getSellerForOwner','getSavedPartIdsForParts'])test(`${method} preserves dashboard errors and existing callers`,async()=>{
 const api=marketplace(Error('private provider error'));
 const args=method==='getSellerForOwner'?['owner']:['owner',['part']];
 const legacy=await api[method](...args);assert.equal(method==='getSellerForOwner'?legacy:legacy.length,method==='getSellerForOwner'?null:0);
 await assert.rejects(()=>api[method](...args,{throwOnError:true}),/temporarily unavailable/);
});
