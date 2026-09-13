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

test("robots fails closed outside an approved production origin",()=>{
 const robots=moduleFrom("src/lib/robots.ts",{"@/lib/metadata":metadata});
 for(const environment of [
  {vercelEnv:"preview",siteUrl:"https://secondpart.co.uk"},
  {vercelEnv:"development",siteUrl:"https://secondpart.co.uk"},
  {vercelEnv:"production",siteUrl:"https://second-part-shop-preview.vercel.app"},
  {vercelEnv:"production",siteUrl:"http://secondpart.co.uk"},
  {vercelEnv:"production",siteUrl:undefined}
 ]){
  const value=robots.buildRobots(environment);
  assert.equal(value.rules.userAgent,"*");
  assert.equal(value.rules.disallow,"/");
  assert.equal(value.sitemap,undefined);
 }
});

test("robots enables crawl and advertises sitemap only for the approved production origin",()=>{
 const robots=moduleFrom("src/lib/robots.ts",{"@/lib/metadata":metadata});
 const value=robots.buildRobots({vercelEnv:"production",siteUrl:"https://www.secondpart.co.uk"});
 assert.equal(value.rules.userAgent,"*");
 assert.equal(value.rules.allow,"/");
 assert.equal(value.rules.disallow,undefined);
 assert.equal(value.sitemap,"https://www.secondpart.co.uk/sitemap.xml");
});

test("robots route delegates to the shared fail-closed builder",()=>{
 let calls=0;
 const route=moduleFrom("src/app/robots.ts",{
  "@/lib/robots":{buildRobots(){calls++;return {rules:{userAgent:"*",disallow:"/"}};}}
 });
 assert.equal(calls,0);
 const value=route.default();
 assert.equal(calls,1);
 assert.equal(value.rules.disallow,"/");
 const source=fs.readFileSync(path.join(root,"src/app/robots.ts"),"utf8");
 assert.match(source,/buildRobots/);
 assert.doesNotMatch(source,/VERCEL_ENV|NEXT_PUBLIC_SITE_URL|vercel\.app|localhost/i);
});
