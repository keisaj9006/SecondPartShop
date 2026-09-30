import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {fileURLToPath} from "node:url";

const verifier=fileURLToPath(new URL("./verify-google-services-config.mjs",import.meta.url));
const generator=fileURLToPath(new URL("./write-ci-google-services.mjs",import.meta.url));
const packageName="com.secondpart.marketplace";

const productionConfig=(clientPackage=packageName,projectId="secondpart-production")=>({
 project_info:{
  project_number:"123456789012",
  project_id:projectId,
  storage_bucket:`${projectId}.appspot.com`
 },
 client:[{
  client_info:{
   mobilesdk_app_id:"1:123456789012:android:0123456789abcdef012345",
   android_client_info:{package_name:clientPackage}
  },
  oauth_client:[],
  api_key:[{current_key:"AIzaSyProductionFixtureKey0000000000000"}],
  services:{appinvite_service:{other_platform_oauth_client:[]}}
 }],
 configuration_version:"1"
});

function verify(config,mode="production"){
 const directory=mkdtempSync(path.join(tmpdir(),"secondpart-google-services-"));
 const file=path.join(directory,"google-services.json");
 writeFileSync(file,JSON.stringify(config),"utf8");
 const result=spawnSync(process.execPath,[verifier,file,packageName,mode],{encoding:"utf8"});
 rmSync(directory,{recursive:true,force:true});
 return result;
}

function verifyGeneratedPlaceholder(mutator){
 const directory=mkdtempSync(path.join(tmpdir(),"secondpart-google-services-ci-"));
 writeFileSync(path.join(directory,"capacitor.config.json"),JSON.stringify({appId:packageName}),"utf8");
 const generated=spawnSync(process.execPath,[generator],{cwd:directory,encoding:"utf8"});
 assert.equal(generated.status,0,generated.stderr||generated.stdout);
 const file=path.join(directory,"android","app","google-services.json");
 if(mutator){
  const config=JSON.parse(readFileSync(file,"utf8"));
  mutator(config);
  writeFileSync(file,JSON.stringify(config),"utf8");
 }
 const result=spawnSync(process.execPath,[verifier,file,packageName,"ci"],{encoding:"utf8"});
 rmSync(directory,{recursive:true,force:true});
 return result;
}

test("production Firebase guard accepts a complete config for the release package",()=>{
 const result=verify(productionConfig());
 assert.equal(result.status,0,result.stderr||result.stdout);
 assert.match(result.stdout,/Verified Firebase Android config for com\.secondpart\.marketplace/);
});

test("production Firebase guard rejects a config for the Preview package",()=>{
 const result=verify(productionConfig("com.secondpart.marketplace.preview"));
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/does not contain Android client com\.secondpart\.marketplace/);
});

test("production Firebase guard rejects the CI placeholder project",()=>{
 const result=verify(productionConfig(packageName,"secondpart-ci-placeholder"));
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/CI placeholder is not permitted for a production build/);
});

test("production Firebase guard rejects an incomplete matching client",()=>{
 const config=productionConfig();
 config.client[0].api_key=[];
 const result=verify(config);
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Matching Android client has no API key/);
});

test("CI mode accepts the exact output of the placeholder generator",()=>{
 const result=verifyGeneratedPlaceholder();
 assert.equal(result.status,0,result.stderr||result.stdout);
});

test("CI mode rejects a structurally valid production configuration",()=>{
 const result=verify(productionConfig(),"ci");
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/CI mode requires the generated Firebase placeholder/);
});

test("CI mode rejects a modified placeholder credential",()=>{
 const result=verifyGeneratedPlaceholder(config=>{
  config.client[0].api_key[0].current_key="AIzaSyModifiedPlaceholderKey000000000000";
 });
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/CI mode requires the generated Firebase placeholder/);
});
