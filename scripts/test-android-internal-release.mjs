import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {load as loadYaml} from "js-yaml";
import {
 EXPECTED_PLAY_APP_SIGNING_SHA256,
 EXPECTED_UPLOAD_SHA256,
 validateInternalOrigin,
 validatePlayAssetLinks,
 validateInternalWorkflow,
 validateRegisteredReleaseWorkflow
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

test("Registered release workflow dispatches the same-commit protected Internal QA workflow",()=>{
 const workflow=readFileSync(path.join(root,".github","workflows","android-release-check.yml"),"utf8");
 assert.doesNotMatch(workflow,/secrets:\s+inherit/);
 const parsed=loadYaml(workflow);
 assert.deepEqual(parsed.jobs?.["build-internal-aab"]?.secrets,{
  ANDROID_RELEASE_KEY_ALIAS:"${{ secrets.ANDROID_RELEASE_KEY_ALIAS }}",
  ANDROID_RELEASE_KEY_PASSWORD:"${{ secrets.ANDROID_RELEASE_KEY_PASSWORD }}",
  ANDROID_RELEASE_STORE_PASSWORD:"${{ secrets.ANDROID_RELEASE_STORE_PASSWORD }}",
  ANDROID_RELEASE_KEYSTORE_BASE64:"${{ secrets.ANDROID_RELEASE_KEYSTORE_BASE64 }}",
  GOOGLE_SERVICES_JSON_BASE64_INTERNAL:"${{ secrets.GOOGLE_SERVICES_JSON_BASE64_INTERNAL }}"
 });
 assert.deepEqual(validateRegisteredReleaseWorkflow(workflow),[]);
 for(const unsafe of [
  workflow.replace("./.github/workflows/android-internal-aab.yml","keisaj9006/SecondPartShop/.github/workflows/android-internal-aab.yml@rebuild-nextjs"),
  workflow.replace("refs/heads/rebuild-nextjs","refs/heads/main"),
  workflow.replace(/    with:\r?\n/,"    secrets: inherit\n    with:\n"),
  workflow.replace("inputs.release_mode == 'internal'","inputs.release_mode == 'dry-run'")
 ])assert.ok(validateRegisteredReleaseWorkflow(unsafe).length>0);
});

test("Reusable Internal QA workflow declares only the five protected environment secrets",()=>{
 const workflow=loadYaml(readFileSync(path.join(root,".github","workflows","android-internal-aab.yml"),"utf8"));
 const declared=workflow.on?.workflow_call?.secrets;
 assert.deepEqual(Object.keys(declared||{}).sort(),[
  "ANDROID_RELEASE_KEY_ALIAS","ANDROID_RELEASE_KEY_PASSWORD","ANDROID_RELEASE_KEYSTORE_BASE64",
  "ANDROID_RELEASE_STORE_PASSWORD","GOOGLE_SERVICES_JSON_BASE64_INTERNAL"
 ].sort());
 for(const definition of Object.values(declared||{}))assert.equal(definition.required,true);
});

test("Registered release workflow fails visibly for Internal QA dispatches from the wrong branch",()=>{
 const workflow=readFileSync(path.join(root,".github","workflows","android-release-check.yml"),"utf8");
 const parsed=loadYaml(workflow);
 const guard=parsed.jobs?.["reject-invalid-internal-ref"];
 assert.equal(guard?.if,"github.event_name == 'workflow_dispatch' && inputs.release_mode == 'internal' && github.ref != 'refs/heads/rebuild-nextjs'");
 assert.match(guard?.steps?.[0]?.run||"",/exit 1/);
});

test("Internal release validator covers both the registered dispatcher and reusable workflow",()=>{
 const validator=readFileSync(path.join(root,"scripts","validate-android-internal-release.mjs"),"utf8");
 assert.match(validator,/android-release-check\.yml/);
 assert.match(validator,/validateRegisteredReleaseWorkflow/);
});

test("Internal workflow restores signing material only after untrusted generation and always removes it",()=>{
 const workflow=readFileSync(path.join(root,".github","workflows","android-internal-aab.yml"),"utf8");
 assert.deepEqual(validateInternalWorkflow(workflow),[]);
 for(const unsafe of [
  workflow.replace("test \"$SECOND_PART_INTERNAL_STRIPE_MODE\" = \"test\"","test \"$SECOND_PART_INTERNAL_STRIPE_MODE\" = \"live\""),
  workflow.replace("Internal Android signing secrets are incomplete.","Signing check removed."),
  workflow.replace("98E69A9586347470048639C5A888D483595A4B4EE4565724661B88F9F13C1670","00E69A9586347470048639C5A888D483595A4B4EE4565724661B88F9F13C1670"),
  workflow.replace("com.secondpart.marketplace production","com.secondpart.marketplace.preview production"),
  workflow.replace(/      - name: Prepare full Internal QA frontend\r?\n        run:/,"      - name: Prepare full Internal QA frontend\n        env:\n          LEAKED_KEY: ${{ secrets.ANDROID_RELEASE_KEYSTORE_BASE64 }}\n        run:"),
  workflow.replace("Restore and verify permanent upload key","Restore key renamed"),
  workflow.replace("npx capacitor-assets generate","echo assets removed"),
  workflow.replace("if: always()","if: success()")
 ])assert.ok(validateInternalWorkflow(unsafe).length>0);
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
 const valid=readFileSync(path.join(root,".github","workflows","android-internal-aab.yml"),"utf8");
 assert.deepEqual(validateInternalWorkflow(valid),[]);
 assert.ok(validateInternalWorkflow(valid.replace("secondpart-internal-release","wrong-environment")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020","uses: actions/setup-node@v4")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("uses: actions/setup-java@cf277c60eb25467037889841efdb72551f06f6c3","run: echo uses: actions/setup-java@cf277c60eb25467037889841efdb72551f06f6c3")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("run: npm ci","run: echo npm-ci-removed")).length>0);
 assert.ok(validateInternalWorkflow(valid.replace("refs/heads/rebuild-nextjs","refs/heads/main")).length>0);
 assert.ok(validateInternalWorkflow(valid.replaceAll("GOOGLE_SERVICES_JSON_BASE64_INTERNAL","GOOGLE_SERVICES_JSON_BASE64_PRODUCTION")).length>0);
 assert.ok(validateInternalWorkflow(valid+"\n  push:\n    branches: [main]\n").length>0);
 assert.ok(validateInternalWorkflow(valid+"\n      - run: fastlane supply\n").length>0);
});
