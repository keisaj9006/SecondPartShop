import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const env=read(".env.example");
const readiness=read("src/lib/platform-readiness.ts");
const fcm=read("src/lib/push/fcm.ts");
const assetlinks=read("src/app/.well-known/assetlinks.json/route.ts");
const workflow=read(".github/workflows/android-production-aab.yml");
const matrix=read("docs/production-environment-matrix.md");

const envHas=name=>new RegExp(`^${name}=`,"m").test(env);
const matrixHas=name=>matrix.includes("`"+name+"`");

const requiredRuntime=[
 "NEXT_PUBLIC_SUPABASE_URL",
 "NEXT_PUBLIC_SUPABASE_ANON_KEY",
 "NEXT_PUBLIC_SITE_URL",
 "NEXT_PUBLIC_SUPPORT_EMAIL",
 "SUPABASE_SERVICE_ROLE_KEY",
 "STRIPE_SECRET_KEY",
 "STRIPE_WEBHOOK_SECRET",
 "CRON_SECRET",
 "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
 "PUSH_DISPATCH_SECRET",
 "ANDROID_APP_LINK_SHA256_FINGERPRINTS",
 "OPS_ALERT_WEBHOOK_URL",
 "OPS_ALERT_WEBHOOK_KIND",
 "OPS_ALERT_WEBHOOK_TOKEN"
];

const releaseSecrets=[
 "ANDROID_RELEASE_KEYSTORE_BASE64",
 "ANDROID_RELEASE_STORE_PASSWORD",
 "ANDROID_RELEASE_KEY_ALIAS",
 "ANDROID_RELEASE_KEY_PASSWORD",
 "GOOGLE_SERVICES_JSON_BASE64_PRODUCTION",
 "ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS"
];

const checks=[
 [".env.example must document every core Production runtime input",requiredRuntime.every(envHas)],
 ["Production environment matrix must document every core runtime input",requiredRuntime.every(matrixHas)],
 ["Production environment matrix must document every Android release secret",releaseSecrets.every(matrixHas)],
 ["Firebase server credential must remain server-only",fcm.includes("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64")&&!envHas("NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT_JSON_BASE64")],
 ["Admin readiness must track Firebase server credential",readiness.includes("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64")],
 ["Admin readiness must track push-dispatch authorization",readiness.includes("PUSH_DISPATCH_SECRET")&&readiness.includes("CRON_SECRET")],
 ["Admin readiness must track live Android App Links fingerprints",readiness.includes("ANDROID_APP_LINK_SHA256_FINGERPRINTS")],
 ["Digital Asset Links route must consume the Production runtime fingerprint set",assetlinks.includes("ANDROID_APP_LINK_SHA256_FINGERPRINTS")&&assetlinks.includes('PACKAGE_NAME="com.secondpart.marketplace"')],
 ["Runtime App Links fingerprint set must not be confused with GitHub Play-signing expectation",envHas("ANDROID_APP_LINK_SHA256_FINGERPRINTS")&&!envHas("ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS")],
 ["Production workflow must keep Play App Signing expectation in GitHub Actions",workflow.includes('ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS: ${{ secrets.ANDROID_PLAY_APP_SIGNING_SHA256_FINGERPRINTS }}')],
 ["Production workflow must keep Firebase Android client config in GitHub Actions",workflow.includes('GOOGLE_SERVICES_JSON_BASE64_PRODUCTION: ${{ secrets.GOOGLE_SERVICES_JSON_BASE64_PRODUCTION }}')],
 ["Production workflow must keep all upload-key inputs in GitHub Actions secrets",["ANDROID_RELEASE_KEYSTORE_BASE64","ANDROID_RELEASE_STORE_PASSWORD","ANDROID_RELEASE_KEY_ALIAS","ANDROID_RELEASE_KEY_PASSWORD"].every(name=>workflow.includes(`secrets.${name}`))],
 ["Production matrix must explicitly distinguish upload signing from Play App Signing",matrix.includes("upload key")&&matrix.includes("Google Play App Signing")&&matrix.includes("must remain separate")],
 ["Production matrix must retain Supabase migration access as an explicit blocker",matrix.includes("You do not have permission to perform this action")&&matrix.includes("pending payout-transfer recovery migration")],
 ["Production matrix must keep DVSA outside the first RC gate",matrix.includes("DVSA")&&matrix.includes("manual vehicle selection")&&matrix.includes("not a blocker for the first RC")]
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?"PASS":"FAIL"}: ${name}`);
 if(!ok)failed++;
}

if(failed){
 console.error(`\n${failed} production environment invariant(s) failed.`);
 process.exit(1);
}

console.log("\nSecondPart Production environment inventory baseline passed.");
