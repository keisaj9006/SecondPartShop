import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const source=fs.readFileSync(path.join(root,"src/components/native-app-mode.tsx"),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

async function nativeHarness(launchUrl=null){
 const calls=[];
 let effect;
 let onUrlOpen;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,URL,Promise,
  require(name){
   if(name==="@/lib/native-push")return {listenForNativePush:()=>()=>{}};
   if(name==="react")return {useEffect:callback=>{effect=callback;}};
   if(name==="next/navigation")return {useRouter:()=>({
    replace:href=>calls.push(["replace",href]),
    push:href=>calls.push(["push",href]),
    refresh:()=>calls.push(["refresh"])
   })};
   throw new Error(`Unexpected dependency: ${name}`);
  },
  window:{location:{origin:"https://secondpart.example"},Capacitor:{isNativePlatform:()=>true,Plugins:{App:{
   addListener(event,callback){assert.equal(event,"appUrlOpen");onUrlOpen=callback;return {remove(){}};},
   async getLaunchUrl(){return {url:launchUrl};}
  }}}},
  document:{documentElement:{classList:{toggle(){},remove(){}}}}
 });
 exports.NativeAppMode();
 const cleanup=effect();
 await Promise.resolve();
 await Promise.resolve();
 return {calls,open:url=>onUrlOpen({url}),cleanup};
}

const completions=[
 ["https://secondpart.example/auth/mobile-complete?state=confirmed","/account"],
 ["https://secondpart.example/checkout/mobile-complete?state=success&order=qa-order","/account/orders/qa-order"],
 ["https://secondpart.example/checkout/mobile-complete?state=cancelled","/account/orders"],
 ["https://secondpart.example/seller/payments/mobile-complete?state=complete","/dashboard/payments"]
];

for(const [url,href] of completions){
 test(`warm native HTTPS completion routes to server-backed destination: ${url}`,async()=>{
  const h=await nativeHarness();h.open(url);
  assert.deepEqual(h.calls,[["replace",href],["refresh"]]);
 });
 test(`cold native HTTPS completion routes to server-backed destination: ${url}`,async()=>{
  const h=await nativeHarness(url);
  assert.deepEqual(h.calls,[["replace",href],["refresh"]]);
 });
}

test("HTTPS native returns reject foreign origins, callback routes and completion path lookalikes",async()=>{
 const rejected=[
  "https://attacker.example/auth/mobile-complete",
  "http://secondpart.example/auth/mobile-complete",
  "https://secondpart.example:444/auth/mobile-complete",
  "https://user:password@secondpart.example/auth/mobile-complete",
  "https://secondpart.example/auth/callback?code=private",
  "https://secondpart.example/auth/confirm?token_hash=private&type=email",
  "https://secondpart.example/auth/reset-password",
  "https://secondpart.example/auth/mobile-complete/extra",
  "https://secondpart.example/checkout/mobile-complete-extra",
  "https://secondpart.example/seller/payments/mobile-complete%2fextra",
  "not a URL"
 ];
 for(const url of rejected){
  const warm=await nativeHarness();warm.open(url);assert.deepEqual(warm.calls,[],url);
  const cold=await nativeHarness(url);assert.deepEqual(cold.calls,[],url);
 }
});

test("native completion queries cannot choose an external route or assert payment/auth state",async()=>{
 const h=await nativeHarness();
 h.open("https://secondpart.example/checkout/mobile-complete?order=qa-order&returnTo=https%3A%2F%2Fattacker.example&state=paid&access_token=private#token_hash=private");
 assert.deepEqual(h.calls,[["replace","/account/orders/qa-order"],["refresh"]]);
 h.calls.length=0;
 h.open("https://secondpart.example/auth/mobile-complete?next=%2Fadmin&state=password-updated&code=private");
 assert.deepEqual(h.calls,[["replace","/account"],["refresh"]]);
});

test("custom-scheme completion routing continues to refresh authoritative server data",async()=>{
 for(const [url,href] of [
  ["secondpart://auth?state=confirmed","/account"],
  ["secondpart://checkout?order=qa-order","/account/orders/qa-order"],
  ["secondpart://seller-payments?state=complete","/dashboard/payments"]
 ]){
  const warm=await nativeHarness();warm.open(url);
  assert.deepEqual(warm.calls,[["replace",href],["refresh"]]);
  const cold=await nativeHarness(url);
  assert.deepEqual(cold.calls,[["replace",href],["refresh"]]);
 }
});

for(const order of ['.','..'])test(`native completion rejects dot-segment order ${order} before navigation`,async()=>{
 for(const prefix of ['secondpart://checkout','https://secondpart.example/checkout/mobile-complete']){
  const url=prefix+'?order='+encodeURIComponent(order);
  const warm=await nativeHarness();warm.open(url);
  assert.deepEqual(warm.calls,[["replace","/account/orders"],["refresh"]]);
  const cold=await nativeHarness(url);assert.deepEqual(cold.calls,[["replace","/account/orders"],["refresh"]]);
 }
});
