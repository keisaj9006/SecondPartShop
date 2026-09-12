import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiled=ts.transpileModule(fs.readFileSync(new URL("../src/app/api/mobile/v1/marketplace/route.ts",import.meta.url),"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function routeHarness(pages){
 const calls=[];const analytics=[];const publicResponses=[];
 const exports={};
 vm.runInNewContext(compiled,{
  exports,URL,URLSearchParams,Request,Response,
  require(name){
   if(name==="next/server")return {after:callback=>callback()};
   if(name==="@/lib/data/vehicle-catalogue")return {getCatalogueSelection:async()=>null};
   if(name==="@/lib/data/marketplace")return {getMarketplacePage:async(filters,options)=>{calls.push({filters,options});return pages.shift();}};
   if(name==="@/lib/identifiers")return {isUuid:()=>false};
   if(name==="@/lib/mobile-api")return {
    mobileJson:(_request,body,status)=>new Response(JSON.stringify(body),{status}),mobileOptions:()=>new Response(null,{status:204}),
    mobilePublicJson:(_request,body,status,maxAge,swr)=>{publicResponses.push({status,maxAge,swr});return new Response(JSON.stringify(body),{status});}
   };
   if(name==="@/lib/mobile-image")return {mobileThumbnailUrl:(_request,url)=>`thumb:${url}`};
   if(name==="@/lib/postcode")return {normalizePostcode:value=>value};
   if(name==="@/lib/analytics/search")return {recordMarketplaceSearch:event=>analytics.push(event)};
   throw new Error(`Unexpected dependency: ${name}`);
  }
 });
 return {GET:exports.GET,calls,analytics,publicResponses};
}

const firstPage={data:[{id:"one",images:[{url:"one.jpg"}]}],error:null,pagination:{offset:0,limit:1,returned:1,total:null,hasMore:true,mode:"cursor",nextCursor:"next-cursor"}};
const secondPage={data:[{id:"two",images:[{url:"two.jpg"}]}],error:null,pagination:{offset:0,limit:1,returned:1,total:null,hasMore:false,mode:"cursor",nextCursor:null}};

test("mobile marketplace forwards the returned nextCursor unchanged and preserves the response pagination contract",async()=>{
 const harness=routeHarness([firstPage,secondPage]);
 const firstResponse=await harness.GET(new Request("https://secondpart.test/api/mobile/v1/marketplace?q=alternator&limit=1"));
 const firstBody=await firstResponse.json();
 assert.equal(firstBody.pagination.nextCursor,"next-cursor");
 assert.equal(firstBody.items[0].images[0].thumbnailUrl,"thumb:one.jpg");

 const returnedCursor=firstBody.pagination.nextCursor;
 const secondResponse=await harness.GET(new Request(`https://secondpart.test/api/mobile/v1/marketplace?q=alternator&limit=1&cursor=${encodeURIComponent(returnedCursor)}`));
 const secondBody=await secondResponse.json();
 assert.equal(harness.calls[1].options.cursor,returnedCursor);
 assert.equal(harness.calls[1].options.offset,0);
 assert.equal(secondBody.pagination.mode,"cursor");
 assert.equal(secondBody.pagination.nextCursor,null);
 assert.equal(harness.analytics.length,1,"cursor continuation must not record another first-page search");
 assert.deepEqual(harness.publicResponses,[{status:200,maxAge:15,swr:60},{status:200,maxAge:15,swr:60}]);
});

test("mobile marketplace trims and bounds oversized cursors before the data boundary",async()=>{
 const harness=routeHarness([secondPage]);
 const oversized=`  next-cursor${"x".repeat(3000)}  `;
 await harness.GET(new Request(`https://secondpart.test/api/mobile/v1/marketplace?q=alternator&cursor=${encodeURIComponent(oversized)}`));
 assert.equal(harness.calls[0].options.cursor.length,2048);
 assert.ok(harness.calls[0].options.cursor.startsWith("next-cursor"));
 assert.equal(harness.calls[0].options.cursor.includes(" "),false);
 assert.equal(harness.analytics.length,0);
});

test("mobile marketplace treats a whitespace-only cursor as an offset first page",async()=>{
 const harness=routeHarness([firstPage]);
 await harness.GET(new Request("https://secondpart.test/api/mobile/v1/marketplace?q=alternator&cursor=%20%20%20"));
 assert.equal("cursor" in harness.calls[0].options,false);
 assert.equal(harness.analytics.length,1);
});

test("mobile marketplace retains offset pagination when no cursor is supplied",async()=>{
 const offsetPage={data:[],error:null,pagination:{offset:40,limit:20,returned:0,total:40,hasMore:false,mode:"offset",nextCursor:null}};
 const harness=routeHarness([offsetPage]);
 const response=await harness.GET(new Request("https://secondpart.test/api/mobile/v1/marketplace?offset=40&limit=20"));
 const body=await response.json();
 assert.equal(harness.calls[0].options.offset,40);
 assert.equal(harness.calls[0].options.limit,20);
 assert.equal(harness.calls[0].options.cursor,undefined);
 assert.equal(body.pagination.offset,40);
 assert.equal(body.pagination.mode,"offset");
});
