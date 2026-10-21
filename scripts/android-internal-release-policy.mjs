export const INTERNAL_ORIGIN="https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app";
export const EXPECTED_UPLOAD_SHA256="98E69A9586347470048639C5A888D483595A4B4EE4565724661B88F9F13C1670";
export const EXPECTED_PLAY_APP_SIGNING_SHA256="916508490C6854B5CFBA742AFF1A3AD3EA853B9FA21C38D1EA3733C2072F6056";

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
export function validateInternalWorkflow(source){
 const errors=[];
 const required=[
  "environment: secondpart-internal-release",
  "uses: actions/setup-node@v4",
  "refs/heads/rebuild-nextjs",
  "secrets.ANDROID_RELEASE_KEY_ALIAS",
  "secrets.ANDROID_RELEASE_KEY_PASSWORD",
  "secrets.ANDROID_RELEASE_STORE_PASSWORD",
  "secrets.ANDROID_RELEASE_KEYSTORE_BASE64",
  "secrets.GOOGLE_SERVICES_JSON_BASE64_INTERNAL",
  "vars.SECOND_PART_INTERNAL_URL",
  "vars.SECOND_PART_INTERNAL_STRIPE_MODE",
  "vars.ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS",
  EXPECTED_UPLOAD_SHA256,
  EXPECTED_PLAY_APP_SIGNING_SHA256
 ];
 if(!/^on:\s*\r?\n\s+workflow_dispatch:/m.test(source))errors.push("Workflow must be manual-only.");
 if(/^\s+push:/m.test(source)||/^\s+pull_request:/m.test(source))errors.push("Workflow must not run automatically.");
 for(const value of required)if(!source.includes(value))errors.push("Missing required Internal QA control: "+value);
 const nodeSetup=source.indexOf("uses: actions/setup-node@v4");
 const firstNodeScript=source.indexOf("node scripts/");
 if(firstNodeScript>=0&&nodeSetup>firstNodeScript)errors.push("Node 22 must be configured before release scripts run.");
 if(/refs\/heads\/(?:main|Production)\b/.test(source))errors.push("Internal QA workflow must not target main or Production.");
 if(/fastlane\s+(?:supply|upload)|google-play|playstore|play\s+publish/i.test(source))errors.push("Workflow must not upload to Google Play.");
 return errors;
}
