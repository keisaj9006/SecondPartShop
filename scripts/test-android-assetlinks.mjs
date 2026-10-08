import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const first="A1".repeat(32),second="B2".repeat(32);
const colon=value=>value.match(/.{2}/g).join(":");
function handler(value){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/.well-known/assetlinks.json/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Response,process:{env:{ANDROID_APP_LINK_SHA256_FINGERPRINTS:value}}});
 return exports.GET;
}
for(const [name,value] of [["comma-separated colon fingerprints",`${colon(first)},${colon(second)}`],["newline-separated colon fingerprints",`${colon(first)}\n${colon(second)}`],["plain lowercase hex fingerprints",`${first.toLowerCase()},${second.toLowerCase()}`],["mixed format with CRLF",` ${first}\r\n${colon(second)} `]])test(`asset links publish ${name}`,async()=>{
 const response=await handler(value)(),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.length,1);
 assert.equal(body[0].target.package_name,"com.secondpart.marketplace");
 assert.equal(body[0].target.namespace,"android_app");assert.deepEqual(body[0].relation,["delegate_permission/common.handle_all_urls"]);
 assert.deepEqual(body[0].target.sha256_cert_fingerprints,[colon(first),colon(second)]);
 assert.equal(response.headers.get("x-content-type-options"),"nosniff");assert.equal(response.headers.get("cache-control"),"public, max-age=300, s-maxage=300, stale-while-revalidate=3600");
});
test("asset links deduplicate equivalent formats after normalization",async()=>{
 const response=await handler(`${first},${colon(first)},${first.toLowerCase()}`)();
 assert.deepEqual((await response.json())[0].target.sha256_cert_fingerprints,[colon(first)]);
});
test("asset links reject malformed fingerprints and never invent a certificate",async()=>{
 for(const value of [undefined,"","A1".repeat(31),"A1".repeat(33),`${first};${second}`,`A:${first.slice(1)}`,"GG".repeat(32),"https://example.invalid",`${first.slice(0,32)} ${first.slice(32)}`])assert.deepEqual(await (await handler(value)()).json(),[]);
 const response=await handler(`${colon(first)},not-a-fingerprint`)();assert.deepEqual((await response.json())[0].target.sha256_cert_fingerprints,[colon(first)]);
});
