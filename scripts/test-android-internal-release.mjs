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

test("Internal AAB toolchain is fully locked and installed only by npm ci",()=>{
 const workflow=readFileSync(path.join(root,".github","workflows","android-internal-aab.yml"),"utf8");
 const packageJson=JSON.parse(readFileSync(path.join(root,"package.json"),"utf8"));
 const expected={
  "@capacitor/core":"8.5.1","@capacitor/cli":"8.5.1","@capacitor/android":"8.5.1",
  "@capacitor/assets":"3.0.5","@capacitor/app":"8.1.1","@capacitor/browser":"8.0.4",
  "@capacitor/camera":"8.2.4","@capacitor/push-notifications":"8.0.4",
  "@aparajita/capacitor-secure-storage":"8.0.0","esbuild":"0.25.9"
 };
 for(const [name,version] of Object.entries(expected))assert.equal(packageJson.devDependencies?.[name],version,`${name} must be exact and lockfile-backed`);
 assert.doesNotMatch(workflow,/npm install\b/);
});

test("Internal workflow policy requires final AAB identity verification",()=>{
 const workflow=readFileSync(path.join(root,".github","workflows","android-internal-aab.yml"),"utf8");
 assert.deepEqual(validateInternalWorkflow(workflow),[]);
 assert.ok(validateInternalWorkflow(workflow.replace("node scripts/verify-android-bundle-identity.mjs","node scripts/removed-bundle-verifier.mjs")).length>0);
});

test("Internal release accepts only the dedicated stable HTTPS origin",()=>{
 assert.equal(validateInternalOrigin("https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app"),"https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app");
 for(const value of [
  "http://internal.secondpart.co.uk",
  "https://second-part-shop-preview.vercel.app",
  "https://internal.secondpart.co.uk",
  "https://www.secondpart.co.uk",
  "https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app/path",
  "https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app?channel=qa"
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
   env:{...process.env,SECOND_PART_INTERNAL_URL:"https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app"}
  });
  assert.equal(result.status,0,result.stderr||result.stdout);
  const config=JSON.parse(readFileSync(path.join(directory,"capacitor.config.json"),"utf8"));
  assert.equal(config.appId,"com.secondpart.marketplace");
  assert.equal(config.server.url,"https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app");
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
  "      - name: Checkout source",
  "        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "      - name: Set up Node 22",
  "        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  "      - uses: actions/setup-java@cf277c60eb25467037889841efdb72551f06f6c3",
  "      - uses: android-actions/setup-android@be39fa834029ff78f1a44aa3bb0819b8fc2bd8fd",
  "      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  "      - run: npm ci",
  "      - run: node scripts/validate-android-internal-release.mjs",
  "      - run: echo ${{ secrets.ANDROID_RELEASE_KEY_ALIAS }}",
  "      - run: echo ${{ secrets.ANDROID_RELEASE_KEY_PASSWORD }}",
  "      - run: echo ${{ secrets.ANDROID_RELEASE_STORE_PASSWORD }}",
  "      - run: echo ${{ secrets.ANDROID_RELEASE_KEYSTORE_BASE64 }}",
  "      - run: echo ${{ secrets.GOOGLE_SERVICES_JSON_BASE64_INTERNAL }}",
  "      - run: echo ${{ vars.SECOND_PART_INTERNAL_URL }}",
  "      - run: echo ${{ vars.SECOND_PART_INTERNAL_STRIPE_MODE }}",
  "      - run: echo ${{ vars.ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS }}",
  "      - run: echo https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar",
  "      - run: echo a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29",
  "      - run: node scripts/verify-android-bundle-identity.mjs final.xml com.secondpart.marketplace 1 0.1.0",
  "      - run: echo "+EXPECTED_UPLOAD_SHA256,
  "      - run: echo "+EXPECTED_PLAY_APP_SIGNING_SHA256
 ].join("\n");
 assert.deepEqual(validateInternalWorkflow(valid),[]);
 assert.ok(validateInternalWorkflow(valid.replace("secondpart-internal-release","wrong-environment")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020","uses: actions/setup-node@v4")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("uses: actions/setup-java@cf277c60eb25467037889841efdb72551f06f6c3","run: echo uses: actions/setup-java@cf277c60eb25467037889841efdb72551f06f6c3")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("      - run: npm ci\n      - run: node scripts/validate-android-internal-release.mjs","      - run: node scripts/validate-android-internal-release.mjs\n      - run: npm ci")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("refs/heads/rebuild-nextjs","refs/heads/main")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("GOOGLE_SERVICES_JSON_BASE64_INTERNAL","GOOGLE_SERVICES_JSON_BASE64_PRODUCTION")).length>0);
 assert.ok(validateInternalWorkflow(valid+"\n  push:\n    branches: [main]\n").length>0);
 assert.ok(validateInternalWorkflow(valid+"\n      - run: fastlane supply\n").length>0);
});
