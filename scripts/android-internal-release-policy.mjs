import { load as loadYaml } from "js-yaml";

export const INTERNAL_ORIGIN="https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app";
export const EXPECTED_UPLOAD_SHA256="98E69A9586347470048639C5A888D483595A4B4EE4565724661B88F9F13C1670";
export const EXPECTED_PLAY_APP_SIGNING_SHA256="916508490C6854B5CFBA742AFF1A3AD3EA853B9FA21C38D1EA3733C2072F6056";
const PINNED_NODE_SETUP="uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020";

export function validateInternalOrigin(rawValue){
 let url;
 try{url=new URL(String(rawValue||"").trim());}catch{
  throw new Error("Internal QA origin must be exactly "+INTERNAL_ORIGIN+".");
 }
 if(url.origin!==INTERNAL_ORIGIN||url.href!==INTERNAL_ORIGIN+"/"){
  throw new Error("Internal QA origin must be exactly "+INTERNAL_ORIGIN+".");
 }
 return url.origin;
}

const normalizeFingerprint=value=>String(value||"").replaceAll(":","").trim().toUpperCase();

export function validatePlayAssetLinks(payload){
 const link=Array.isArray(payload)?payload.find(item=>
  Array.isArray(item?.relation)&&
  item.relation.includes("delegate_permission/common.handle_all_urls")&&
  item?.target?.namespace==="android_app"&&
  item?.target?.package_name==="com.secondpart.marketplace"&&
  Array.isArray(item?.target?.sha256_cert_fingerprints)
 ):null;
 const values=new Set((link?.target?.sha256_cert_fingerprints||[]).map(normalizeFingerprint));
 if(!values.has(EXPECTED_PLAY_APP_SIGNING_SHA256)){
  throw new Error("Android App Links must authorize the Google Play App Signing certificate for com.secondpart.marketplace.");
 }
 return true;
}

export function validateRegisteredReleaseWorkflow(source){
 const errors=[];
 let workflow;
 try{workflow=loadYaml(source);}catch(error){return [`Workflow YAML is invalid: ${error instanceof Error?error.message:"unknown parse error"}`];}
 if(!workflow||typeof workflow!=="object")return ["Workflow YAML must contain an object."];
 const dispatch=workflow.on?.workflow_dispatch;
 const mode=dispatch?.inputs?.release_mode;
 if(mode?.type!=="choice"||mode?.default!=="dry-run"||!Array.isArray(mode?.options)||!mode.options.includes("dry-run")||!mode.options.includes("internal")){
  errors.push("Registered workflow must require an explicit dry-run or internal release mode.");
 }
 const jobs=workflow.jobs&&typeof workflow.jobs==="object"?workflow.jobs:{};
 const dryRun=jobs["validate-release-bundle"];
 const internal=jobs["build-internal-aab"];
 const invalidRef=jobs["reject-invalid-internal-ref"];
 const expectedDryRun="github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && inputs.release_mode == 'dry-run')";
 const expectedInternal="github.event_name == 'workflow_dispatch' && inputs.release_mode == 'internal' && github.ref == 'refs/heads/rebuild-nextjs'";
 const expectedSecrets={
  ANDROID_RELEASE_KEY_ALIAS:"${{ secrets.ANDROID_RELEASE_KEY_ALIAS }}",
  ANDROID_RELEASE_KEY_PASSWORD:"${{ secrets.ANDROID_RELEASE_KEY_PASSWORD }}",
  ANDROID_RELEASE_STORE_PASSWORD:"${{ secrets.ANDROID_RELEASE_STORE_PASSWORD }}",
  ANDROID_RELEASE_KEYSTORE_BASE64:"${{ secrets.ANDROID_RELEASE_KEYSTORE_BASE64 }}",
  GOOGLE_SERVICES_JSON_BASE64_INTERNAL:"${{ secrets.GOOGLE_SERVICES_JSON_BASE64_INTERNAL }}"
 };
 if(dryRun?.if!==expectedDryRun)errors.push("Dry-run job must not execute for an Internal QA dispatch.");
 if(internal?.if!==expectedInternal)errors.push("Internal dispatcher must fail closed to rebuild-nextjs and explicit internal mode.");
 if(internal?.uses!=="./.github/workflows/android-internal-aab.yml")errors.push("Internal dispatcher must call the same-commit Internal QA workflow by relative path.");
 if(JSON.stringify(internal?.secrets)!==JSON.stringify(expectedSecrets))errors.push("Caller workflow must forward exactly the five named Internal QA secrets, never inherit all repository secrets.");
 if(internal?.with?.version_name!=="${{ inputs.version_name }}"||internal?.with?.version_code!=="${{ inputs.version_code }}"){
  errors.push("Internal dispatcher must forward the approved version inputs unchanged.");
 }
 const expectedInvalidRef="github.event_name == 'workflow_dispatch' && inputs.release_mode == 'internal' && github.ref != 'refs/heads/rebuild-nextjs'";
 if(invalidRef?.if!==expectedInvalidRef||!invalidRef?.steps?.some(step=>typeof step?.run==="string"&&step.run.includes("exit 1"))){
  errors.push("Wrong-branch Internal QA dispatch must fail visibly without entering the protected environment.");
 }
 if(/refs\/heads\/(?:main|Production)\b/.test(JSON.stringify(workflow)))errors.push("Registered workflow must not target main or Production.");
 return errors;
}

export function validateInternalWorkflow(source){
 const errors=[];
 let workflow;
 try{workflow=loadYaml(source);}catch(error){return [`Workflow YAML is invalid: ${error instanceof Error?error.message:"unknown parse error"}`];}
 if(!workflow||typeof workflow!=="object")return ["Workflow YAML must contain an object."];
 const triggers=workflow.on;
 const triggerKeys=triggers&&typeof triggers==="object"&&!Array.isArray(triggers)?Object.keys(triggers):[];
 if(!triggerKeys.includes("workflow_dispatch")||!triggerKeys.includes("workflow_call")||triggerKeys.some(key=>!["workflow_dispatch","workflow_call"].includes(key))){
  errors.push("Internal workflow must support only manual and same-commit reusable dispatch.");
 }
 const expectedSecretNames=["ANDROID_RELEASE_KEY_ALIAS","ANDROID_RELEASE_KEY_PASSWORD","ANDROID_RELEASE_STORE_PASSWORD","ANDROID_RELEASE_KEYSTORE_BASE64","GOOGLE_SERVICES_JSON_BASE64_INTERNAL"].sort();
 const declaredSecrets=triggers?.workflow_call?.secrets;
 const declaredNames=declaredSecrets&&typeof declaredSecrets==="object"?Object.keys(declaredSecrets).sort():[];
 if(JSON.stringify(declaredNames)!==JSON.stringify(expectedSecretNames)||declaredNames.some(name=>declaredSecrets[name]?.required!==true)){
  errors.push("Reusable workflow must require exactly the five protected Internal QA secrets.");
 }
 const jobs=workflow.jobs&&typeof workflow.jobs==="object"?Object.values(workflow.jobs):[];
 const job=jobs.find(candidate=>candidate&&typeof candidate==="object"&&candidate.environment==="secondpart-internal-release");
 if(!job)errors.push("Workflow must use the protected secondpart-internal-release environment.");
 if(job?.if!=="github.ref == 'refs/heads/rebuild-nextjs'")errors.push("Workflow must be restricted to rebuild-nextjs.");
 const steps=Array.isArray(job?.steps)?job.steps:[];
 const requiredActions=[
  "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  "actions/setup-java@cf277c60eb25467037889841efdb72551f06f6c3",
  "android-actions/setup-android@be39fa834029ff78f1a44aa3bb0819b8fc2bd8fd",
  "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
 ];
 for(const action of requiredActions)if(!steps.some(step=>step?.uses===action))errors.push("Missing pinned Internal QA action: "+action);
 const serialized=JSON.stringify(workflow);
 const required=[
  "refs/heads/rebuild-nextjs",
  "secrets.ANDROID_RELEASE_KEY_ALIAS",
  "secrets.ANDROID_RELEASE_KEY_PASSWORD",
  "secrets.ANDROID_RELEASE_STORE_PASSWORD",
  "secrets.ANDROID_RELEASE_KEYSTORE_BASE64",
  "secrets.GOOGLE_SERVICES_JSON_BASE64_INTERNAL",
  "vars.SECOND_PART_INTERNAL_URL",
  "vars.SECOND_PART_INTERNAL_STRIPE_MODE",
  "vars.ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS",
  "https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar",
  "a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29",
  "node scripts/verify-android-bundle-identity.mjs",
  EXPECTED_UPLOAD_SHA256,
  EXPECTED_PLAY_APP_SIGNING_SHA256
 ];
 if(!/^on:\s*\r?\n\s+workflow_dispatch:/m.test(source)||!/^\s+workflow_call:/m.test(source))errors.push("Internal workflow must expose manual and reusable dispatch only.");
 if(/^\s+push:/m.test(source)||/^\s+pull_request:/m.test(source))errors.push("Workflow must not run automatically.");
 for(const value of required)if(!serialized.includes(value))errors.push("Missing required Internal QA control: "+value);
 const nodeSetup=steps.findIndex(step=>step?.uses===PINNED_NODE_SETUP.slice("uses: ".length));
 const npmCi=steps.findIndex(step=>typeof step?.run==="string"&&step.run.trim()==="npm ci");
 const firstNodeScript=steps.findIndex(step=>typeof step?.run==="string"&&step.run.includes("node scripts/"));
 if(firstNodeScript>=0&&nodeSetup>firstNodeScript)errors.push("Node 22 must be configured before release scripts run.");
 if(npmCi<0||(firstNodeScript>=0&&npmCi>firstNodeScript))errors.push("npm ci must install the locked release dependencies before release scripts run.");
 const boundary=steps.findIndex(step=>step?.name==="Enforce Internal QA release boundary");
 if(boundary>=0&&!steps[boundary].run?.includes('test "$SECOND_PART_INTERNAL_STRIPE_MODE" = "test"'))errors.push("Internal QA workflow must fail closed unless Stripe mode is test.");
 const assets=steps.findIndex(step=>typeof step?.run==="string"&&step.run.includes("capacitor-assets generate"));
 const firebase=steps.findIndex(step=>step?.name==="Configure Internal QA Firebase services");
 const packageContract=steps.findIndex(step=>step?.name==="Verify package and SDK contract");
 const restore=steps.findIndex(step=>step?.name==="Restore and verify permanent upload key");
 const patch=steps.findIndex(step=>step?.name==="Patch Internal QA Android release");
 const build=steps.findIndex(step=>step?.name==="Build signed Android App Bundle");
 const cleanup=steps.findIndex(step=>step?.name==="Remove private signing material");
 const signingSecretNames=["ANDROID_RELEASE_KEYSTORE_BASE64","ANDROID_RELEASE_STORE_PASSWORD","ANDROID_RELEASE_KEY_ALIAS","ANDROID_RELEASE_KEY_PASSWORD"];
 const allowedSigningSteps=new Set(["Restore and verify permanent upload key","Patch Internal QA Android release","Build signed Android App Bundle"]);
 if(signingSecretNames.some(name=>JSON.stringify(job?.env||{}).includes(`secrets.${name}`)))errors.push("Signing secrets must never be exposed at job scope.");
 for(const step of steps){
  const value=JSON.stringify(step);
  if(signingSecretNames.some(name=>value.includes(`secrets.${name}`))&&!allowedSigningSteps.has(step?.name))errors.push("Signing secrets are exposed outside the restore, patch or signing steps.");
  if(value.includes("secrets.GOOGLE_SERVICES_JSON_BASE64_INTERNAL")&&step?.name!=="Configure Internal QA Firebase services")errors.push("Firebase configuration secret is exposed outside its validation step.");
 }
 if([assets,firebase,packageContract,restore,patch,build,cleanup].some(index=>index<0))errors.push("Internal workflow is missing a required pre-signing, signing or cleanup step.");
 if([assets,firebase,packageContract,restore,patch,build,cleanup].every(index=>index>=0)){
  if([assets,firebase,packageContract].some(index=>index<0||index>restore))errors.push("Asset generation, Firebase validation and package checks must finish before the private JKS is restored.");
  if(patch<restore||build<patch)errors.push("Signing configuration and bundle build must run only after the JKS is verified.");
  if(!steps[restore].run?.includes("Internal Android signing secrets are incomplete."))errors.push("Signing secret completeness must fail closed before JKS restoration.");
  if(!steps[restore].run?.includes(EXPECTED_UPLOAD_SHA256))errors.push("Restored JKS must match the approved upload signer.");
  if(firebase>=0&&!steps[firebase].run?.includes("verify-google-services-config.mjs android/app/google-services.json com.secondpart.marketplace production"))errors.push("Firebase configuration must be validated for the release package.");
  if(cleanup<build||steps[cleanup]?.if!=="always()"||!steps[cleanup]?.run?.includes('rm -f -- "$RUNNER_TEMP/secondpart-upload.jks"'))errors.push("Private JKS must be removed after signing even when the build fails.");
 }
 if(/refs\/heads\/(?:main|Production)\b/.test(serialized))errors.push("Internal QA workflow must not target main or Production.");
 if(/fastlane\s+(?:supply|upload)|google-play|playstore|play\s+publish/i.test(serialized))errors.push("Workflow must not upload to Google Play.");
 return errors;
}
