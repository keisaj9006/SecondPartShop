import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const exists=(path)=>fs.existsSync(path);

const productionPrep=read("scripts/prepare-android-production.mjs");
const productionPatch=read("scripts/patch-android-production.mjs");
const productionWorkflow=read(".github/workflows/android-production-aab.yml");
const releaseCheck=read(".github/workflows/android-release-check.yml");
const privacy=read("src/app/privacy/page.tsx");
const terms=read("src/app/terms/page.tsx");
const accountDeletion=read("src/app/account-deletion/page.tsx");
const accountSecurity=read("src/app/account/security/page.tsx");
const contact=read("src/app/contact/page.tsx");

const checks=[
 ["Production Android package must be separate from Preview",productionPrep.includes('config.appId="com.secondpart.marketplace"')&&!productionPrep.includes('marketplace.preview')],
 ["Production Android must use the full HTTPS frontend",productionPrep.includes("config.server={url:productionUrl.origin,cleartext:false}")],
 ["Production Android must reject preview/local targets",productionPrep.includes("/preview|localhost|127\\.0\\.0\\.1/i")],
 ["Production Android must disable debug logging",productionPrep.includes('loggingBehavior="none"')&&productionPrep.includes("webContentsDebuggingEnabled:false")],
 ["Google Play target must be API 36",productionPatch.includes("compileSdkVersion = 36")&&productionPatch.includes("targetSdkVersion = 36")],
 ["Production Android must build a release AAB",productionWorkflow.includes("./gradlew bundleRelease --no-daemon")],
 ["Production AAB signer must be verified",productionWorkflow.includes("Verify AAB signature")&&productionWorkflow.includes("AAB signer does not match the production upload key")],
 ["Production signing must be isolated from Preview signing",productionWorkflow.includes("ANDROID_RELEASE_KEYSTORE_BASE64")&&!productionWorkflow.includes("ANDROID_PREVIEW_KEYSTORE_BASE64")],
 ["Production Firebase must be isolated from Preview Firebase",productionWorkflow.includes("GOOGLE_SERVICES_JSON_BASE64_PRODUCTION")],
 ["Release pipeline must have a no-secret dry-run",releaseCheck.includes("Create ephemeral CI signing key")&&releaseCheck.includes("Build production-style Android App Bundle")],
 ["Public privacy policy route must exist",exists("src/app/privacy/page.tsx")&&privacy.includes("SecondPart Privacy Policy")],
 ["Privacy policy must describe deletion",privacy.includes("/account-deletion")&&privacy.includes("Retention and deletion")],
 ["Public external account-deletion route must exist",exists("src/app/account-deletion/page.tsx")&&accountDeletion.includes("Delete your SecondPart account")],
 ["In-app account deletion must remain available",accountSecurity.includes("Delete account")&&accountSecurity.includes("AccountDeletionForm")],
 ["Support route must remain available",contact.includes("Contact SecondPart")],
 ["Terms must describe current payment architecture",terms.includes("Stripe")&&terms.includes("buyer protection")&&!terms.includes("Payments are not enabled in the current preview")],
];

const unresolved=[
 "Production domain and production Firebase configuration are external launch inputs.",
 "Permanent Google Play upload key and release secrets must be created and stored securely.",
 "Final developer/company identity, privacy contact and legal review are required before public commerce.",
 "Play Console Data safety, app access, content rating, target audience and store-listing declarations are manual Console work.",
 "Store assets (512x512 PNG icon, feature graphic and screenshots) are release assets, not validated by this code check.",
 "Physical-device release-candidate QA and end-to-end FCM/checkout/camera/deep-link tests are still required.",
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}
console.log("\nLaunch items intentionally tracked outside code:");
for(const item of unresolved)console.log("WARN: "+item);

if(failed){
 console.error(`\n${failed} launch baseline invariant(s) failed.`);
 process.exit(1);
}
console.log("\nSecondPart code-level launch baseline passed.");
