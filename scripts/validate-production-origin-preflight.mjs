import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const preflight=read("scripts/verify-production-origin.mjs");
const workflow=read(".github/workflows/android-production-aab.yml");
const assetlinks=read("src/app/.well-known/assetlinks.json/route.ts");

const checks=[
 ["Production origin preflight must require HTTPS",preflight.includes('base.protocol!=="https:"')],
 ["Production origin preflight must reject preview/local/Vercel preview hosts",preflight.includes("vercel\\.app")&&preflight.includes("preview")&&preflight.includes("localhost")],
 ["Production origin preflight must verify homepage",preflight.includes('get("/")')&&preflight.includes("SecondPart")],
 ["Production origin preflight must verify public Privacy Policy",preflight.includes('get("/privacy")')&&preflight.includes("SecondPart Privacy Policy")],
 ["Production origin preflight must require configured public support email",preflight.includes("privacyEmail")&&preflight.includes("contactEmail")&&preflight.includes("contactEmail!==privacyEmail")],
 ["Production origin preflight must verify external account deletion",preflight.includes('get("/account-deletion")')&&preflight.includes("external account-deletion route for SecondPart")],
 ["Production origin preflight must verify Android asset links",preflight.includes('get("/.well-known/assetlinks.json"')&&preflight.includes("delegate_permission/common.handle_all_urls")],
 ["Production origin preflight must bind App Links to the production package",preflight.includes('PACKAGE_NAME="com.secondpart.marketplace"')],
 ["Production origin preflight must compare App Links to the expected signing fingerprint",preflight.includes("ANDROID_EXPECTED_SIGNER_SHA256")&&preflight.includes("normalizeFingerprint")],
 ["Asset Links route must remain production-package scoped",assetlinks.includes('PACKAGE_NAME="com.secondpart.marketplace"')&&assetlinks.includes("ANDROID_APP_LINK_SHA256_FINGERPRINTS")],
 ["Production AAB workflow must derive an expected signer fingerprint before origin verification",workflow.includes("ANDROID_EXPECTED_SIGNER_SHA256")&&workflow.includes("keytool -list -v")],
 ["Production AAB workflow must run the network origin preflight",workflow.includes("node scripts/verify-production-origin.mjs")],
 ["Production origin preflight must happen before bundleRelease",workflow.indexOf("node scripts/verify-production-origin.mjs")>=0&&workflow.indexOf("node scripts/verify-production-origin.mjs")<workflow.indexOf("./gradlew bundleRelease")],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} production origin preflight invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSecondPart production origin preflight baseline passed.");
