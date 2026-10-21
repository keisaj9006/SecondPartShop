import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {
 EXPECTED_PLAY_APP_SIGNING_SHA256,
 EXPECTED_UPLOAD_SHA256,
 validateInternalOrigin,
 validatePlayAssetLinks,
 validateInternalWorkflow
} from "./android-internal-release-policy.mjs";

const root=path.resolve(import.meta.dirname,"..");
const prepare=path.join(root,"scripts","prepare-android-internal.mjs");

test("Internal release accepts only the dedicated stable HTTPS origin",()=>{
 assert.equal(validateInternalOrigin("https://internal.secondpart.co.uk"),"https://internal.secondpart.co.uk");
 for(const value of [
  "http://internal.secondpart.co.uk",
  "https://second-part-shop-preview.vercel.app",
  "https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app",
  "https://www.secondpart.co.uk",
  "https://internal.secondpart.co.uk/path",
  "https://internal.secondpart.co.uk?channel=qa"
 ]){
  assert.throws(()=>validateInternalOrigin(value),/Internal QA origin/);
 }
});

test("Internal preparation produces the Play package with release hardening",()=>{
 const directory=mkdtempSync(path.join(tmpdir(),"secondpart-internal-"));
 try{
  writeFileSync(path.join(directory,"capacitor.config.json"),JSON.stringify({
   appId:"com.secondpart.marketplace.preview",
   appName:"SecondPart",
   webDir:"mobile-shell",
   loggingBehavior:"debug",
   android:{webContentsDebuggingEnabled:true}
  }),"utf8");
  const result=spawnSync(process.execPath,[prepare],{
   cwd:directory,
   encoding:"utf8",
   env:{...process.env,SECOND_PART_INTERNAL_URL:"https://internal.secondpart.co.uk"}
  });
  assert.equal(result.status,0,result.stderr||result.stdout);
  const config=JSON.parse(readFileSync(path.join(directory,"capacitor.config.json"),"utf8"));
  assert.equal(config.appId,"com.secondpart.marketplace");
  assert.equal(config.server.url,"https://internal.secondpart.co.uk");
  assert.equal(config.server.cleartext,false);
  assert.equal(config.loggingBehavior,"none");
  assert.equal(config.android.webContentsDebuggingEnabled,false);
 }finally{
  rmSync(directory,{recursive:true,force:true});
 }
});

test("Internal preparation refuses a Vercel Preview alias",()=>{
 const directory=mkdtempSync(path.join(tmpdir(),"secondpart-internal-"));
 try{
  writeFileSync(path.join(directory,"capacitor.config.json"),JSON.stringify({appId:"x",webDir:"mobile-shell"}),"utf8");
  const result=spawnSync(process.execPath,[prepare],{
   cwd:directory,
   encoding:"utf8",
   env:{...process.env,SECOND_PART_INTERNAL_URL:"https://second-part-shop-preview.vercel.app"}
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Internal QA origin/);
 }finally{
  rmSync(directory,{recursive:true,force:true});
 }
});

test("Internal App Links require the Google Play signer, never only the upload signer",()=>{
 const payload=[{
  relation:["delegate_permission/common.handle_all_urls"],
  target:{
   namespace:"android_app",
   package_name:"com.secondpart.marketplace",
   sha256_cert_fingerprints:[EXPECTED_PLAY_APP_SIGNING_SHA256]
  }
 }];
 assert.doesNotThrow(()=>validatePlayAssetLinks(payload));
 const uploadOnly=structuredClone(payload);
 uploadOnly[0].target.sha256_cert_fingerprints=[EXPECTED_UPLOAD_SHA256];
 assert.throws(()=>validatePlayAssetLinks(uploadOnly),/Play App Signing/);
 const wrongPackage=structuredClone(payload);
 wrongPackage[0].target.package_name="com.secondpart.marketplace.preview";
 assert.throws(()=>validatePlayAssetLinks(wrongPackage),/Play App Signing/);
});
test("Internal workflow policy requires the protected environment and fails closed inputs",()=>{
 const valid=[
  "name: Android Internal QA AAB",
  "on:",
  "  workflow_dispatch:",
  "jobs:",
  "  build:",
  "    environment: secondpart-internal-release",
  "    if: github.ref == 'refs/heads/rebuild-nextjs'",
  "    steps:",
  "      - name: Set up Node 22",
  "        uses: actions/setup-node@v4",
  "      - run: node scripts/validate-android-internal-release.mjs",
  "      - run: echo ${{ secrets.ANDROID_RELEASE_KEY_ALIAS }}",
  "      - run: echo ${{ secrets.ANDROID_RELEASE_KEY_PASSWORD }}",
  "      - run: echo ${{ secrets.ANDROID_RELEASE_STORE_PASSWORD }}",
  "      - run: echo ${{ secrets.ANDROID_RELEASE_KEYSTORE_BASE64 }}",
  "      - run: echo ${{ secrets.GOOGLE_SERVICES_JSON_BASE64_INTERNAL }}",
  "      - run: echo ${{ vars.SECOND_PART_INTERNAL_URL }}",
  "      - run: echo ${{ vars.SECOND_PART_INTERNAL_STRIPE_MODE }}",
  "      - run: echo "+EXPECTED_UPLOAD_SHA256,
  "      - run: echo "+EXPECTED_PLAY_APP_SIGNING_SHA256
 ].join("\n");
 assert.deepEqual(validateInternalWorkflow(valid),[]);
 assert.ok(validateInternalWorkflow(valid.replace("secondpart-internal-release","wrong-environment")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("uses: actions/setup-node@v4","run: node --version")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("refs/heads/rebuild-nextjs","refs/heads/main")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("GOOGLE_SERVICES_JSON_BASE64_INTERNAL","GOOGLE_SERVICES_JSON_BASE64_PRODUCTION")).length>0);
 assert.ok(validateInternalWorkflow(valid+"\n  push:\n    branches: [main]\n").length>0);
 assert.ok(validateInternalWorkflow(valid+"\n      - run: fastlane supply\n").length>0);
});
