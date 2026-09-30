import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/auth-email-origin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL});
const resolve=exports.resolveAuthEmailOrigin;
const base={configuredOrigin:'https://second-part-shop-preview.vercel.app',vercelEnv:'preview',vercelBranchUrl:'shop-git-branch-team.vercel.app',vercelUrl:'shop-deploy-team.vercel.app'};
test('PKCE email preserves trusted canonical alias where verifier cookie was set',()=>{
 assert.equal(resolve({...base,requestOrigin:base.configuredOrigin}),base.configuredOrigin);
});
test('PKCE email preserves exact deployment origin where verifier cookie was set',()=>{
 assert.equal(resolve({...base,requestOrigin:'https://'+base.vercelUrl}),'https://'+base.vercelUrl);
});
test('trusted branch origin is retained',()=>{
 assert.equal(resolve({...base,requestOrigin:'https://'+base.vercelBranchUrl}),'https://'+base.vercelBranchUrl);
});
test('untrusted origins cannot receive confirmation credentials',()=>{
 for(const requestOrigin of ['https://evil.test','https://shop-deploy-team.vercel.app.evil.test','https://other.vercel.app','https://user@shop-deploy-team.vercel.app','https://shop-deploy-team.vercel.app/path','http://shop-deploy-team.vercel.app','null']){
  assert.equal(resolve({...base,requestOrigin}),'https://'+base.vercelBranchUrl,requestOrigin);
 }
});
test('production also preserves explicitly configured deployment origin only',()=>{
 assert.equal(resolve({...base,vercelEnv:'production',requestOrigin:'https://'+base.vercelUrl}),'https://'+base.vercelUrl);
 assert.equal(resolve({...base,vercelEnv:'production',requestOrigin:'https://evil.test'}),base.configuredOrigin);
});
test('development retains configured localhost origin',()=>{
 assert.equal(resolve({configuredOrigin:'http://localhost:3000',requestOrigin:'http://localhost:3000'}),'http://localhost:3000');
});
