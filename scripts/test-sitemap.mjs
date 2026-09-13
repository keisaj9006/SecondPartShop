import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");

function moduleFrom(relativePath,dependencies={},globals={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const output=ts.transpileModule(source,{
  compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 vm.runInNewContext(output,{
  exports,
  require(name){if(name in dependencies)return dependencies[name];throw new Error(`Unexpected dependency ${name} in ${relativePath}`);},
  process:{env:{}},URL,URLSearchParams,console,...globals
 });
 return exports;
}

const metadata=moduleFrom("src/lib/metadata.ts");

const sitemapRows=[
 {partSlug:"ford-focus-alternator",partUpdatedAt:"2026-09-12T10:00:00.000Z",sellerSlug:"northern-recyclers"},
 {partSlug:"vw-golf-starter",partUpdatedAt:"2026-09-13T11:00:00.000Z",sellerSlug:"northern-recyclers"},
 {partSlug:"bmw-3-series-mirror",partUpdatedAt:"2026-09-11T09:00:00.000Z",sellerSlug:"edinburgh-breakers"}
];

test("sitemap stays empty outside an approved production origin",()=>{
 const sitemap=moduleFrom("src/lib/sitemap.ts",{"@/lib/metadata":metadata});
 for(const environment of [
  {vercelEnv:"preview",siteUrl:"https://secondpart.co.uk"},
  {vercelEnv:"development",siteUrl:"https://secondpart.co.uk"},
  {vercelEnv:"production",siteUrl:"https://second-part-shop-preview.vercel.app"},
  {vercelEnv:"production",siteUrl:"http://secondpart.co.uk"},
  {vercelEnv:"production",siteUrl:undefined}
 ]){
  assert.equal(sitemap.buildSitemapEntries(sitemapRows,environment).length,0);
 }
});

test("production sitemap contains only home, active part rows and deduplicated seller routes",()=>{
 const sitemap=moduleFrom("src/lib/sitemap.ts",{"@/lib/metadata":metadata});
 const entries=sitemap.buildSitemapEntries(sitemapRows,{vercelEnv:"production",siteUrl:"https://www.secondpart.co.uk"});
 const urls=[...entries].map(entry=>entry.url);
 assert.deepEqual(urls,[
  "https://www.secondpart.co.uk/",
  "https://www.secondpart.co.uk/parts/ford-focus-alternator",
  "https://www.secondpart.co.uk/parts/vw-golf-starter",
  "https://www.secondpart.co.uk/parts/bmw-3-series-mirror",
  "https://www.secondpart.co.uk/seller/northern-recyclers",
  "https://www.secondpart.co.uk/seller/edinburgh-breakers"
 ]);
 assert.equal(entries[0].priority,1);
 assert.equal(entries[0].changeFrequency,"daily");
 assert.equal(entries.filter(entry=>entry.url.includes("/seller/northern-recyclers")).length,1);
 assert.equal(entries.find(entry=>entry.url.endsWith("/seller/northern-recyclers")).lastModified,"2026-09-13T11:00:00.000Z");
});

test("sitemap route uses paged public reads and requests no private seller data",async()=>{
 const pages=[
  Array.from({length:1000},(_,index)=>({slug:`part-${index}`,updated_at:"2026-09-13T10:00:00.000Z",sellers:{slug:"seller-a"}})),
  [{slug:"part-1000",updated_at:"2026-09-13T11:00:00.000Z",sellers:{slug:"seller-b"}}]
 ];
 const calls=[];
 const client={
  from(table){
   calls.push(["from",table]);
   const builder={
    select(columns){calls.push(["select",columns]);return builder;},
    eq(column,value){calls.push(["eq",column,value]);return builder;},
    order(column,options){calls.push(["order",column,options]);return builder;},
    async range(start,end){calls.push(["range",start,end]);return {data:pages.shift()??[],error:null};}
   };
   return builder;
  }
 };
 const route=moduleFrom("src/app/sitemap.ts",{
  "@/lib/supabase/public-server":{createSupabasePublicServerClient:()=>client},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>true},
  "@/lib/sitemap":{buildSitemapEntries:rows=>rows}
 });
 const rows=await route.default();
 assert.equal(rows.length,1001);
 assert.deepEqual(calls.filter(call=>call[0]==="range"),[["range",0,999],["range",1000,1999]]);
 assert.ok(calls.some(call=>call[0]==="eq"&&call[1]==="status"&&call[2]==="active"));
 const selection=String(calls.find(call=>call[0]==="select")?.[1]??"");
 assert.match(selection,/slug/);
 assert.match(selection,/updated_at/);
 assert.match(selection,/sellers!inner\(slug\)/);
 assert.doesNotMatch(selection,/postcode|latitude|longitude|owner_id|description/i);
 const source=fs.readFileSync(path.join(root,"src/app/sitemap.ts"),"utf8");
 assert.match(source,/createSupabasePublicServerClient/);
 assert.doesNotMatch(source,/service[_-]?role|createSupabaseAdminClient/i);
});

test("sitemap route fails closed when Supabase is unavailable",async()=>{
 const route=moduleFrom("src/app/sitemap.ts",{
  "@/lib/supabase/public-server":{createSupabasePublicServerClient:()=>{throw new Error("must not connect");}},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>false},
  "@/lib/sitemap":{buildSitemapEntries:rows=>rows}
 });
 const rows=await route.default();
 assert.equal(rows.length,0);
});
